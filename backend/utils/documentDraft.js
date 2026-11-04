import path from "path";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import {
  PdfDraftError,
  pdfToDraft,
  savePdfImage,
  summaryFrom,
  titleFromFileName,
  usableTitle,
} from "./pdfDraft.js";

const MAX_TEXT_CHARS = 400_000;

export class DocumentDraftError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = "DocumentDraftError";
  }
}

export const IMPORT_EXTENSIONS = [".pdf", ".csv", ".txt", ".text", ".doc", ".docx"];

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.from(input || []);
}

function decodeText(buffer) {
  const raw = asBuffer(buffer);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return raw.slice(2).toString("utf16le");
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    const swapped = Buffer.alloc(raw.length - 2);
    for (let i = 2; i < raw.length - 1; i += 2) {
      swapped[i - 2] = raw[i + 1];
      swapped[i - 1] = raw[i];
    }
    return swapped.toString("utf16le");
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    return raw.slice(3).toString("utf8");
  }
  return raw.toString("utf8");
}

function clipText(text) {
  const trimmed = String(text || "").replace(/\u0000/g, "").trim();
  if (!trimmed) return { text: "", truncated: false };
  if (trimmed.length <= MAX_TEXT_CHARS) return { text: trimmed, truncated: false };
  return { text: trimmed.slice(0, MAX_TEXT_CHARS).trim(), truncated: true };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function csvToMarkdown(text) {
  const rows = parseCsv(text);
  if (!rows.length) return "";
  if (rows.length === 1 && rows[0].length <= 1) return String(text || "").trim();
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const next = [...row];
    while (next.length < width) next.push("");
    return next.map(escapeCell);
  });
  const header = padded[0];
  const body = padded.slice(1);
  const sep = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ];
  return lines.join("\n");
}

function finishDraft({ title, content, extra = {} }) {
  const clipped = clipText(content);
  if (!clipped.text) {
    throw new DocumentDraftError("Berkas tidak berisi teks yang bisa dijadikan draf");
  }
  const body = clipped.truncated
    ? `${clipped.text}\n\nSebagian isi tidak ikut karena batas impor.`
    : clipped.text;
  return {
    title: usableTitle(title) || "Panduan",
    summary: summaryFrom(clipped.text, title),
    content: body,
    imageCount: 0,
    ...extra,
  };
}

function htmlImgsToMarkdown(text) {
  return String(text || "").replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] || "";
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] || "Gambar";
    return src ? `\n\n![${alt}](${src})\n\n` : "";
  });
}

function countMarkdownImages(text) {
  return [...String(text || "").matchAll(/!\[[^\]]*\]\([^)]+\)/g)].length;
}

function imageExt(contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("gif")) return "gif";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

async function docxToDraft(buffer, fileName) {
  let result;
  try {
    result = await mammoth.convertToMarkdown(
      { buffer: asBuffer(buffer) },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const bytes = await image.readAsBuffer();
          const url = await savePdfImage(bytes, imageExt(image.contentType));
          return { src: url };
        }),
      },
    );
  } catch {
    throw new DocumentDraftError("Dokumen Word (.docx) tidak bisa dibaca");
  }
  const markdown = htmlImgsToMarkdown(String(result?.value || "")).replace(/\n{3,}/g, "\n\n").trim();
  if (!markdown) throw new DocumentDraftError("Dokumen Word kosong");
  return finishDraft({
    title: titleFromFileName(fileName),
    content: markdown,
    extra: { imageCount: countMarkdownImages(markdown) },
  });
}

async function docToDraft(buffer, fileName) {
  try {
    const extractor = new WordExtractor();
    const document = await extractor.extract(asBuffer(buffer));
    const parts = [
      document.getBody?.() || "",
      document.getHeaders?.() || "",
      document.getFootnotes?.() || "",
      document.getEndnotes?.() || "",
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    const content = parts.join("\n\n");
    if (!content) throw new DocumentDraftError("Dokumen Word kosong");
    return finishDraft({
      title: titleFromFileName(fileName),
      content,
    });
  } catch (error) {
    if (error instanceof DocumentDraftError) throw error;
    throw new DocumentDraftError("Dokumen Word (.doc) tidak bisa dibaca");
  }
}

function textToDraft(buffer, fileName) {
  return finishDraft({
    title: titleFromFileName(fileName),
    content: decodeText(buffer),
  });
}

function csvToDraft(buffer, fileName) {
  const markdown = csvToMarkdown(decodeText(buffer));
  return finishDraft({
    title: titleFromFileName(fileName),
    content: markdown,
  });
}

export function detectImportKind(fileName = "", mime = "", buffer) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  const type = String(mime || "").toLowerCase();
  if (ext === ".pdf" || type === "application/pdf") return "pdf";
  if (ext === ".csv" || type === "text/csv" || type === "application/csv") {
    return "csv";
  }
  if (ext === ".txt" || ext === ".text" || type === "text/plain") return "txt";
  if (ext === ".docx" || type.includes("wordprocessingml")) return "docx";
  if (ext === ".doc" || type === "application/msword") return "doc";
  if (ext) return "";
  const bytes = asBuffer(buffer);
  if (bytes.slice(0, 4).toString("latin1") === "%PDF") return "pdf";
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx";
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return "doc";
  }
  return "";
}

export function pastedTextToDraft(text, { title } = {}) {
  const clipped = clipText(text);
  if (!clipped.text) throw new DocumentDraftError("Teks kosong");
  const first = clipped.text
    .split("\n")
    .map((row) => row.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return finishDraft({
    title: usableTitle(title) || usableTitle(first) || "Catatan tempel",
    content: clipped.text,
  });
}

export async function fileToDraft(buffer, { fileName = "dokumen.txt", mime = "" } = {}) {
  const kind = detectImportKind(fileName, mime, buffer);
  if (!kind) {
    throw new DocumentDraftError("Format tidak didukung. Pakai PDF, CSV, TXT, TEXT, DOC, atau DOCX.");
  }
  if (kind === "pdf") {
    try {
      return await pdfToDraft(buffer, { fileName });
    } catch (error) {
      if (error instanceof PdfDraftError) {
        throw new DocumentDraftError(error.message, error.status || 400);
      }
      throw error;
    }
  }
  if (kind === "csv") return csvToDraft(buffer, fileName);
  if (kind === "txt") return textToDraft(buffer, fileName);
  if (kind === "docx") return docxToDraft(buffer, fileName);
  return docToDraft(buffer, fileName);
}
