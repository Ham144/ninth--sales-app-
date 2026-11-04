const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^(\d+)[.)]\s+(.+)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const SEP_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const SEP_INLINE_RE = /\|(?:\s*:?-{2,}:?\s*\|)+/;

function safeHref(href) {
  const value = String(href || "").trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}

function linkLabel(label, href) {
  const text = String(label || "").trim();
  try {
    const url = new URL(href);
    const bare = `${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}${url.search}`;
    const normalized = text.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (!text || normalized === bare || text === href) return bare;
  } catch {
    return text || href;
  }
  return text;
}

function ReplyLink({ href, children }) {
  return (
    <a className="reply-link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function splitCells(line) {
  let text = String(line || "").trim();
  if (!text) return [];
  if (!text.startsWith("|")) text = `|${text}`;
  if (!text.endsWith("|")) text = `${text}|`;
  return text
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isTableRow(line) {
  const trimmed = String(line || "").trim();
  return trimmed.includes("|") && trimmed.replace(/\|/g, "").trim() !== "" && (trimmed.startsWith("|") || /\|.+\|/.test(trimmed));
}

function isSeparator(line) {
  return SEP_RE.test(String(line || "").trim());
}

function inlineFormat(text, keyBase) {
  const source = String(text || "").replace(/\*\*/g, "\u0001");
  const re = /(\u0001[^\u0001\n]+\u0001|`[^`\n]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<>)\]]+)/g;
  const parts = [];
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(source))) {
    if (match.index > last) parts.push(source.slice(last, match.index).replace(/\u0001/g, ""));
    const token = match[0];
    const id = `${keyBase}-${key}`;
    key += 1;
    if (token.startsWith("\u0001")) {
      parts.push(<strong key={id}>{token.slice(1, -1)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={id}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const linked = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      const href = safeHref(linked?.[2]);
      parts.push(href ? <ReplyLink key={id} href={href}>{linkLabel(linked[1], href)}</ReplyLink> : token);
    } else {
      const trimmed = token.replace(/[.,;:!?]+$/, "");
      const tail = token.slice(trimmed.length);
      const href = safeHref(trimmed);
      parts.push(href ? <ReplyLink key={id} href={href}>{linkLabel(trimmed, href)}</ReplyLink> : token);
      if (tail) parts.push(tail);
    }
    last = match.index + token.length;
  }
  if (last < source.length) parts.push(source.slice(last).replace(/\u0001/g, ""));
  return parts.length ? parts : source.replace(/\u0001/g, "");
}

function tableBlock(headers, rows, key) {
  if (!headers.length || !rows.length) return null;
  return (
    <div key={key} className="reply-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((cell, index) => (
              <th key={index}>{inlineFormat(cell, `${key}-h-${index}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((_, col) => (
                <td key={col}>{inlineFormat(row[col] || "", `${key}-r${rowIndex}-${col}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function collapsedTable(text, key) {
  const source = String(text || "");
  const sep = source.match(SEP_INLINE_RE);
  if (!sep) return null;
  const firstPipe = source.indexOf("|");
  if (firstPipe < 0) return null;
  const intro = firstPipe > 0 ? source.slice(0, firstPipe).trim() : "";
  const headerCells = splitCells(source.slice(firstPipe, sep.index)).filter(Boolean);
  const bodyCells = splitCells(source.slice(sep.index + sep[0].length)).filter(Boolean);
  const cols = headerCells.length;
  if (cols < 2) return null;
  const rows = [];
  for (let i = 0; i < bodyCells.length; i += cols) {
    const row = bodyCells.slice(i, i + cols);
    if (row.length === cols && row.some(Boolean)) rows.push(row);
  }
  const table = tableBlock(headerCells.slice(0, cols), rows, key);
  if (!table) return null;
  return { intro, table };
}

export function renderReply(raw) {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const image = trimmed.match(IMG_RE);
    if (image) {
      const href = safeHref(image[2]);
      if (href) {
        blocks.push(
          <figure key={key} className="reply-figure">
            <img src={href} alt={image[1] || ""} />
            {(image[3] || image[1]) && <figcaption>{image[3] || image[1]}</figcaption>}
          </figure>,
        );
        key += 1;
        i += 1;
        continue;
      }
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(<Tag key={key}>{inlineFormat(heading[2], key)}</Tag>);
      key += 1;
      i += 1;
      continue;
    }

    if (isTableRow(trimmed) && (isSeparator(lines[i + 1] || "") || isTableRow(lines[i + 1] || ""))) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        const line = lines[i].trim();
        if (!isSeparator(line)) rows.push(splitCells(line));
        i += 1;
      }
      const headers = rows.shift() || [];
      const table = tableBlock(headers, rows, key);
      if (table) {
        blocks.push(table);
        key += 1;
        continue;
      }
    }

    if (UL_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && UL_RE.test(lines[i].trim())) {
        items.push(lines[i].trim().match(UL_RE)[1]);
        i += 1;
      }
      blocks.push(
        <ul key={key}>
          {items.map((item, index) => (
            <li key={index}>{inlineFormat(item, `${key}-${index}`)}</li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }

    if (OL_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && OL_RE.test(lines[i].trim())) {
        items.push(lines[i].trim().match(OL_RE)[2]);
        i += 1;
      }
      blocks.push(
        <ol key={key}>
          {items.map((item, index) => (
            <li key={index}>{inlineFormat(item, `${key}-${index}`)}</li>
          ))}
        </ol>,
      );
      key += 1;
      continue;
    }

    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        HEADING_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next) ||
        isTableRow(next)
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    const joined = para.join(" ");
    const collapsed = collapsedTable(joined, key);
    if (collapsed) {
      if (collapsed.intro) {
        blocks.push(<p key={`${key}-p`}>{inlineFormat(collapsed.intro, `${key}-p`)}</p>);
      }
      blocks.push(collapsed.table);
    } else {
      blocks.push(<p key={key}>{inlineFormat(joined, key)}</p>);
    }
    key += 1;
  }

  return <div className="reply-body">{blocks}</div>;
}
