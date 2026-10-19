import { Fragment } from "react";

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^(\d+)\.\s+(.+)$/;

function inlineFormat(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) {
        parts.push(
          <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

/**
 * Lightweight blogger-style markdown: headings, lists, images, paragraphs.
 */
export function renderBlogContent(raw) {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const img = trimmed.match(IMG_RE);
    if (img) {
      blocks.push(
        <figure key={key++} className="blog-figure">
          <img src={img[2]} alt={img[1] || ""} loading="lazy" />
          {(img[3] || img[1]) && (
            <figcaption>{img[3] || img[1]}</figcaption>
          )}
        </figure>,
      );
      i += 1;
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(<Tag key={key++}>{inlineFormat(heading[2])}</Tag>);
      i += 1;
      continue;
    }

    if (UL_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && UL_RE.test(lines[i].trim())) {
        items.push(lines[i].trim().match(UL_RE)[1]);
        i += 1;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (OL_RE.test(trimmed)) {
      const items = [];
      while (i < lines.length && OL_RE.test(lines[i].trim())) {
        items.push(lines[i].trim().match(OL_RE)[2]);
        i += 1;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const para = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        IMG_RE.test(next) ||
        HEADING_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next)
      ) {
        break;
      }
      para.push(next);
      i += 1;
    }
    blocks.push(<p key={key++}>{inlineFormat(para.join(" "))}</p>);
  }

  return <Fragment>{blocks}</Fragment>;
}

export function formatDocDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
