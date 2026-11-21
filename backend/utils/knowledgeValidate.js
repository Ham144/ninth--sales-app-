/**
 * Curated knowledge corpus guards — not a 300GB dump lane.
 * Keep docs short enough to chunk/embed; require app tagging.
 */

export const MAX_KNOWLEDGE_CONTENT_CHARS = 80_000;
export const MIN_KNOWLEDGE_CONTENT_CHARS = 40;
export const MAX_KNOWLEDGE_TITLE_CHARS = 200;
export const MAX_KNOWLEDGE_SUMMARY_CHARS = 400;
export const MAX_KNOWLEDGE_IMPORT_BYTES = 8 * 1024 * 1024;

export class KnowledgeValidateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.name = "KnowledgeValidateError";
  }
}

function hasPipeTable(text) {
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length - 1; i += 1) {
    const row = lines[i].trim();
    const sep = lines[i + 1].trim();
    if (row.includes("|") && /^\|?\s*:?-{2,}/.test(sep)) return true;
  }
  return false;
}

/**
 * @param {object} body
 * @returns {{ warnings: string[] }}
 */
export function assertKnowledgeDoc(body = {}) {
  const title = String(body.title || "").trim();
  const content = String(body.content || "").trim();
  const summary = String(body.summary || "").trim();
  const docType = body.docType;
  const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean) : [];
  const warnings = [];

  if (docType !== "howto" && docType !== "technical") {
    throw new KnowledgeValidateError("docType harus howto atau technical");
  }
  if (!title) throw new KnowledgeValidateError("Judul wajib");
  if (title.length > MAX_KNOWLEDGE_TITLE_CHARS) {
    throw new KnowledgeValidateError(`Judul maksimal ${MAX_KNOWLEDGE_TITLE_CHARS} karakter`);
  }
  if (!content) throw new KnowledgeValidateError("Konten wajib");
  if (content.length < MIN_KNOWLEDGE_CONTENT_CHARS) {
    throw new KnowledgeValidateError(
      `Konten terlalu pendek (min ${MIN_KNOWLEDGE_CONTENT_CHARS} karakter). Knowledge hanya untuk materi yang bisa dipakai AI.`,
    );
  }
  if (content.length > MAX_KNOWLEDGE_CONTENT_CHARS) {
    throw new KnowledgeValidateError(
      `Konten terlalu besar (${content.length.toLocaleString("id-ID")} karakter). Batas ${MAX_KNOWLEDGE_CONTENT_CHARS.toLocaleString("id-ID")}. Ini korpus curated, bukan tempat dump 300GB. Potong atau pecah dokumen.`,
    );
  }
  if (summary.length > MAX_KNOWLEDGE_SUMMARY_CHARS) {
    throw new KnowledgeValidateError(`Ringkasan maksimal ${MAX_KNOWLEDGE_SUMMARY_CHARS} karakter`);
  }
  if (!tags.length) {
    throw new KnowledgeValidateError(
      "Tandai minimal satu aplikasi atau Others. Tanpa tag, knowledge tidak tertaut dan mudah jadi dump acak.",
    );
  }
  if (body.visibility != null && body.visibility !== "public" && body.visibility !== "internal") {
    throw new KnowledgeValidateError("visibility harus public atau internal");
  }

  // Heuristic: dense pipe-less grid often means broken PDF table paste.
  const pipeCount = (content.match(/\|/g) || []).length;
  const lineCount = content.split("\n").length;
  if (lineCount > 40 && pipeCount < 4 && /\t{2,}|\s{4,}\S+\s{4,}/.test(content)) {
    warnings.push(
      "Isi terlihat seperti tabel tanpa markdown. Untuk tabel, unggah CSV atau tulis markdown table agar header terikat ke tiap baris.",
    );
  }
  if (hasPipeTable(content)) {
    warnings.push("Tabel markdown terdeteksi — saat index, header akan diikat ke setiap baris.");
  }

  return { warnings };
}
