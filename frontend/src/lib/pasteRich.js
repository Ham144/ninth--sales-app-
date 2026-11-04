export const MAX_PASTE_IMAGES = 20;

export function isKeepableImageSrc(src) {
  const value = String(src || "").trim();
  if (value.startsWith("/uploads/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isDataImageSrc(src) {
  return /^data:image\//i.test(String(src || "").trim());
}

export function fillImageSlots(markdown, urlsByIndex) {
  return String(markdown || "").replace(/!\[([^\]]*)\]\(@@IMG_(\d+)@@\)/g, (all, alt, rawIndex) => {
    const url = urlsByIndex[Number(rawIndex)];
    if (!url) return alt ? `*(gambar tidak terbawa: ${alt})*` : "";
    return `![${alt}](${url})`;
  });
}

export function clipboardHasImages(clipboardData) {
  if (!clipboardData) return false;
  const html = clipboardData.getData?.("text/html") || "";
  if (/<img\b/i.test(html)) return true;
  const items = [...(clipboardData.items || [])];
  if (items.some((item) => item.type?.startsWith("image/"))) return true;
  const files = [...(clipboardData.files || [])];
  return files.some((file) => file.type?.startsWith("image/"));
}

export function clipboardImageFiles(clipboardData) {
  const seen = new Set();
  const files = [];
  const push = (file) => {
    if (!file || seen.has(file)) return;
    if (!String(file.type || "").startsWith("image/") && !/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || "")) {
      return;
    }
    seen.add(file);
    files.push(file);
  };
  for (const item of clipboardData?.items || []) {
    if (item.kind === "file") push(item.getAsFile?.());
  }
  for (const file of clipboardData?.files || []) push(file);
  return files.slice(0, MAX_PASTE_IMAGES);
}

function headingPrefix(tag) {
  if (tag === "h1") return "# ";
  if (tag === "h2") return "## ";
  if (tag === "h3" || tag === "h4") return "### ";
  return "";
}

export function htmlToMarkdown(html) {
  if (typeof DOMParser === "undefined") {
    return { markdown: String(html || "").replace(/<[^>]+>/g, " ").trim(), images: [] };
  }
  const source = String(html || "")
    .replace(/<!--StartFragment-->/gi, "")
    .replace(/<!--EndFragment-->/gi, "");
  const doc = new DOMParser().parseFromString(source, "text/html");
  const images = [];

  const walk = (node) => {
    if (!node) return "";
    if (node.nodeType === Node.COMMENT_NODE) return "";
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "meta", "link", "xml"].includes(tag)) return "";
    if (tag === "br") return "\n";
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const alt = (node.getAttribute("alt") || node.getAttribute("title") || "").trim() || `Gambar ${images.length + 1}`;
      const index = images.length;
      images.push({ alt, src, index });
      return `\n\n![${alt}](@@IMG_${index}@@)\n\n`;
    }
    const inner = [...node.childNodes].map(walk).join("");
    const heading = headingPrefix(tag);
    if (heading) return `\n\n${heading}${inner.trim()}\n\n`;
    if (tag === "li") return `\n- ${inner.trim()}`;
    if (tag === "p" || tag === "div" || tag === "tr" || tag === "table" || tag === "section") {
      return `\n\n${inner.trim()}\n\n`;
    }
    if (tag === "strong" || tag === "b") return `**${inner.trim()}**`;
    if (tag === "a") return inner;
    return inner;
  };

  const markdown = walk(doc.body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown, images };
}

async function dataUrlToFile(src, name) {
  const res = await fetch(src);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([blob], name.replace(/\.[^.]+$/, "") + `.${ext}`, { type });
}

export async function clipboardToMarkdown(clipboardData, { upload } = {}) {
  const html = clipboardData?.getData?.("text/html") || "";
  const text = clipboardData?.getData?.("text/plain") || clipboardData?.getData?.("text") || "";
  const files = clipboardImageFiles(clipboardData);
  const parsed = html ? htmlToMarkdown(html) : { markdown: String(text || "").trim(), images: [] };
  let markdown = parsed.markdown || String(text || "").trim();
  let fileCursor = 0;
  const urls = [];
  let imageCount = 0;

  const slotCount = parsed.images.length;
  for (let index = 0; index < slotCount; index += 1) {
    if (imageCount >= MAX_PASTE_IMAGES) {
      urls[index] = "";
      continue;
    }
    const meta = parsed.images[index] || {};
    let url = "";
    try {
      if (isKeepableImageSrc(meta.src) && !isDataImageSrc(meta.src)) {
        url = meta.src.trim();
      } else if (isDataImageSrc(meta.src)) {
        url = await upload(await dataUrlToFile(meta.src, `paste-${index}`));
        imageCount += 1;
      } else if (fileCursor < files.length) {
        url = await upload(files[fileCursor]);
        fileCursor += 1;
        imageCount += 1;
      }
    } catch {
      url = "";
    }
    urls[index] = url;
  }

  markdown = fillImageSlots(markdown, urls);

  while (fileCursor < files.length && imageCount < MAX_PASTE_IMAGES) {
    try {
      const url = await upload(files[fileCursor]);
      fileCursor += 1;
      imageCount += 1;
      markdown = `${markdown}\n\n![Gambar ${imageCount}](${url})`.trim();
    } catch {
      fileCursor += 1;
    }
  }

  if (!markdown.trim()) return { markdown: String(text || "").trim(), imageCount };
  return { markdown: markdown.trim(), imageCount };
}

export async function filesToImageMarkdown(files, { upload } = {}) {
  const images = [...(files || [])].filter((file) =>
    String(file.type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || ""),
  );
  const parts = [];
  let imageCount = 0;
  for (const file of images.slice(0, MAX_PASTE_IMAGES)) {
    const url = await upload(file);
    imageCount += 1;
    const alt = String(file.name || `Gambar ${imageCount}`).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    parts.push(`![${alt}](${url})`);
  }
  return { markdown: parts.join("\n\n"), imageCount };
}
