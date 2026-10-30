import fs from "fs/promises";
import path from "path";
import pngjs from "pngjs";
import { extractTextItems, getDocumentProxy, getMeta, getResolvedPDFJS } from "unpdf";

const { PNG } = pngjs;

const MAX_PAGES = 80;
const MAX_IMAGES = 40;
const MIN_PIXEL = 16;
const MIN_DISPLAY = 12;

if (typeof ArrayBuffer.prototype.transferToFixedLength !== "function") {
  Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", {
    configurable: true,
    writable: true,
    value(newByteLength = this.byteLength) {
      const length = Math.max(0, Number(newByteLength) || 0);
      const out = new ArrayBuffer(length);
      new Uint8Array(out).set(new Uint8Array(this).subarray(0, length));
      return out;
    },
  });
}

if (typeof ArrayBuffer.prototype.transfer !== "function") {
  Object.defineProperty(ArrayBuffer.prototype, "transfer", {
    configurable: true,
    writable: true,
    value(newByteLength = this.byteLength) {
      return this.transferToFixedLength(newByteLength);
    },
  });
}

export class PdfDraftError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function asMatrix(args) {
  const flat = args?.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  if (!flat || flat.length !== 6) return null;
  return flat.map(Number);
}

function boxOf(ctm) {
  const [a, b, c, d, e, f] = ctm;
  const ys = [f, b + f, d + f, b + d + f];
  return {
    width: Math.hypot(a, b),
    height: Math.hypot(c, d),
    top: Math.max(...ys),
    x: e,
  };
}

function loadImage(page, key) {
  return new Promise((resolve) => {
    const store = String(key).startsWith("g_") ? page.commonObjs : page.objs;
    try {
      store.get(key, (image) => resolve(image || null));
    } catch {
      resolve(null);
    }
  });
}

function encodedImage(image) {
  const data = Buffer.from(image?.data || []);
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xd8) {
    return { bytes: data, ext: "jpg" };
  }
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return { bytes: data, ext: "png" };
  }
  const width = image?.width;
  const height = image?.height;
  if (!width || !height) return null;
  const channels = data.length / (width * height);
  if (channels !== 1 && channels !== 3 && channels !== 4) return null;
  const png = new PNG({ width, height });
  if (channels === 4) {
    png.data.set(data);
  } else if (channels === 3) {
    for (let p = 0, o = 0; p < width * height; p += 1, o += 3) {
      const i = p * 4;
      png.data[i] = data[o];
      png.data[i + 1] = data[o + 1];
      png.data[i + 2] = data[o + 2];
      png.data[i + 3] = 255;
    }
  } else {
    for (let p = 0; p < width * height; p += 1) {
      const i = p * 4;
      png.data[i] = data[p];
      png.data[i + 1] = data[p];
      png.data[i + 2] = data[p];
      png.data[i + 3] = 255;
    }
  }
  return { bytes: PNG.sync.write(png), ext: "png" };
}

async function imagesOnPage(page, OPS) {
  const operatorList = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const found = [];
  const seen = new Set();

  for (let i = 0; i < operatorList.fnArray.length; i += 1) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];
    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      const matrix = asMatrix(args);
      if (matrix) ctm = multiply(ctm, matrix);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      const key = args?.[0];
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const image = await loadImage(page, key);
      if (!image?.data || !image.width || !image.height) continue;
      const box = boxOf(ctm);
      const displayed = box.width > 1 || box.height > 1 ? box : {
        width: image.width,
        height: image.height,
        top: ctm[5] + image.height,
      };
      if (image.width < MIN_PIXEL || image.height < MIN_PIXEL) continue;
      if (displayed.width < MIN_DISPLAY || displayed.height < MIN_DISPLAY) continue;
      found.push({ image, y: displayed.top });
    }
  }
  return found;
}

function linesFromItems(items) {
  const sorted = (items || [])
    .filter((item) => item?.str)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    const fontSize = item.fontSize || 12;
    const last = lines.at(-1);
    if (last && Math.abs(last.y - item.y) <= Math.max(2, fontSize * 0.45)) {
      const gap = item.x - last.endX;
      last.text += `${gap > fontSize * 0.25 ? " " : ""}${item.str}`;
      last.endX = item.x + (item.width || 0);
      last.fontSize = Math.max(last.fontSize, fontSize);
    } else {
      lines.push({
        y: item.y,
        text: item.str,
        endX: item.x + (item.width || 0),
        fontSize,
      });
    }
  }
  return lines
    .map((line) => ({ ...line, text: line.text.replace(/\s+/g, " ").trim() }))
    .filter((line) => line.text);
}

function median(values) {
  if (!values.length) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function markdownAlt(text, index) {
  const clean = String(text || "")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return `Gambar ${index}`;
  return clean.slice(0, 80);
}

function pageMarkdown(lines, images) {
  const bodySize = median(lines.map((line) => line.fontSize));
  const blocks = [
    ...lines.map((line) => {
      const heading =
        line.fontSize >= bodySize * 1.25 &&
        line.text.length >= 3 &&
        line.text.length <= 90 &&
        !/[.!?]$/.test(line.text);
      return {
        y: line.y,
        kind: "text",
        text: heading ? `## ${line.text}` : line.text,
        fontSize: line.fontSize,
      };
    }),
    ...images.map((image) => ({
      y: image.y,
      kind: "image",
      url: image.url,
      alt: image.alt,
    })),
  ].sort((a, b) => b.y - a.y || (a.kind === "text" ? -1 : 1));

  const parts = [];
  let previous = null;
  for (const block of blocks) {
    if (block.kind === "image") {
      parts.push(`![${markdownAlt(block.alt, parts.length + 1)}](${block.url})`);
      previous = block;
      continue;
    }
    if (previous?.kind === "text" && previous.y - block.y > Math.max(previous.fontSize, block.fontSize) * 1.35) {
      parts.push("");
    }
    parts.push(block.text);
    previous = block;
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function usableTitle(value) {
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if (!title) return "";
  if (/^(untitled|microsoft word|document|pdf|untitled document)$/i.test(title)) return "";
  return title.slice(0, 140);
}

function titleFromFileName(fileName) {
  const base = path.basename(String(fileName || "panduan.pdf"), path.extname(fileName || ""))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return usableTitle(base) || "Panduan";
}

function summaryFrom(text, title) {
  const line = text
    .split("\n")
    .map((row) => row.replace(/^#+\s*/, "").trim())
    .find((row) => row && row !== title && !row.startsWith("!["));
  if (!line) return "";
  if (line.length <= 180) return line;
  const cut = line.slice(0, 180);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

export async function savePdfImage(bytes, ext) {
  const uploadDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const name = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.writeFile(path.join(uploadDir, name), bytes);
  return `/uploads/${name}`;
}

/**
 * PDF menjadi draf artikel. Tidak menulis HubKnowledgeDoc.
 * saveImage(bytes, ext) mengembalikan URL yang dipakai markdown.
 */
export async function pdfToDraft(buffer, { fileName = "panduan.pdf", saveImage = savePdfImage } = {}) {
  const bytes = new Uint8Array(buffer || []);
  if (!bytes.byteLength) throw new PdfDraftError("PDF kosong");

  let pdf;
  try {
    pdf = await getDocumentProxy(bytes);
  } catch (error) {
    const message = String(error?.message || error);
    if (/password/i.test(message)) {
      throw new PdfDraftError("PDF terkunci. Buka kuncinya dulu, lalu jatuhkan lagi.");
    }
    throw new PdfDraftError("PDF tidak bisa dibaca");
  }

  const pageCount = pdf.numPages || 0;
  if (!pageCount) throw new PdfDraftError("PDF tidak punya halaman");
  const pagesToRead = Math.min(pageCount, MAX_PAGES);
  let imagesLeft = MAX_IMAGES;
  let imageCount = 0;
  let truncated = pageCount > pagesToRead;
  const pageTexts = [];

  const { OPS } = await getResolvedPDFJS();
  const { items } = await extractTextItems(pdf);

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const lines = linesFromItems(items[pageNumber - 1]);
    const placed = [];
    if (imagesLeft > 0) {
      const rawImages = await imagesOnPage(page, OPS);
      for (const raw of rawImages) {
        if (imagesLeft <= 0) {
          truncated = true;
          break;
        }
        const encoded = encodedImage(raw.image);
        if (!encoded) continue;
        const above = lines
          .filter((line) => line.y >= raw.y)
          .sort((a, b) => a.y - b.y)[0];
        const url = await saveImage(encoded.bytes, encoded.ext);
        imageCount += 1;
        imagesLeft -= 1;
        placed.push({
          y: raw.y,
          url,
          alt: above?.text || `Gambar ${imageCount}`,
        });
      }
    } else if (!truncated) {
      const skipped = await imagesOnPage(page, OPS);
      if (skipped.length) truncated = true;
    }
    const markdown = pageMarkdown(lines, placed);
    if (markdown) pageTexts.push(markdown);
  }

  const contentBody = pageTexts.join("\n\n").trim();
  if (!contentBody) throw new PdfDraftError("PDF tidak berisi teks atau gambar yang bisa dijadikan draf");

  const meta = await getMeta(pdf);
  const firstHeading = contentBody
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.startsWith("## "))
    ?.replace(/^##\s+/, "");
  const title = usableTitle(meta?.info?.Title) || usableTitle(firstHeading) || titleFromFileName(fileName);
  const content = truncated
    ? `${contentBody}\n\nSebagian halaman atau gambar tidak ikut karena batas impor.`
    : contentBody;

  return {
    title,
    summary: summaryFrom(contentBody, title),
    content,
    imageCount,
    pageCount,
  };
}
