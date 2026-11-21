/** Curated knowledge rules — keep UI + client checks aligned with backend. */

export const MAX_KNOWLEDGE_CONTENT_CHARS = 80_000;
export const MIN_KNOWLEDGE_CONTENT_CHARS = 40;
export const MAX_KNOWLEDGE_IMPORT_BYTES = 8 * 1024 * 1024;
export const TAG_OTHERS = "others";

export const KNOWLEDGE_RULES = [
  "Ini korpus curated untuk AI staf — bukan data lake. Jangan dump arsip besar / 300GB.",
  "Satu berkas = satu topik. Aplikasi + kategori custom boleh diisi otomatis saat impor, lalu dibetulkan.",
  "Tabel: CSV atau markdown table. PDF tabel sering hilang header↔nilai.",
  "XLSX belum didukung — export CSV dulu.",
  "PDF/DOC untuk prosedur narasi. Max ~8 MB impor; konten max 80.000 karakter.",
];

const TOPIC_HINTS = [
  { re: /\b(harga|pricelist|price.?list|tarif)\b/i, tag: "harga" },
  { re: /\b(stok|stock|inventory|persediaan)\b/i, tag: "stok" },
  { re: /\b(sop|prosedur|cara pakai|howto|panduan)\b/i, tag: "sop" },
  { re: /\b(retur|return|pengembalian)\b/i, tag: "retur" },
  { re: /\b(invoice|faktur|scan.?invoice)\b/i, tag: "invoice" },
  { re: /\b(petty.?cash|kas kecil)\b/i, tag: "petty-cash" },
  { re: /\b(pos|kasir)\b/i, tag: "pos" },
  { re: /\b(gudang|warehouse|lokasi)\b/i, tag: "gudang" },
  { re: /\b(customer|pelanggan|toko|piutang)\b/i, tag: "customer" },
  { re: /\b(n8n|workflow|otomasi)\b/i, tag: "otomasi" },
  { re: /\b(csv|katalog|sku|daftar.?harga)\b/i, tag: "katalog" },
];

export function slugifyTag(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function formatTagLabel(tag, apps = []) {
  const id = String(tag || "");
  if (id === TAG_OTHERS) return "Others";
  const app = (apps || []).find((item) => item.id === id);
  if (app?.title) return app.title;
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function suggestAppFromText(apps, haystack) {
  const hay = ` ${String(haystack || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")} `;
  const hits = (apps || []).filter((app) => {
    const id = String(app.id || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    const title = String(app.title || "").toLowerCase();
    if (id.length >= 4 && hay.includes(` ${id} `)) return true;
    if (title.length >= 5 && hay.includes(title)) return true;
    return false;
  });
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Auto tags for import: one app (or others) + topic/custom slugs from name/content.
 * Always editable afterward.
 */
export function suggestKnowledgeTags({
  apps = [],
  fileName = "",
  title = "",
  summary = "",
  content = "",
  presetAppId = null,
} = {}) {
  const appIds = new Set(apps.map((app) => app.id));
  const haystack = `${fileName} ${title} ${summary} ${String(content || "").slice(0, 2000)}`;
  const custom = new Set();

  const preset = presetAppId ? apps.find((app) => app.id === presetAppId) : null;
  const suggested = preset || suggestAppFromText(apps, haystack);
  const appId = suggested?.id || null;

  for (const hint of TOPIC_HINTS) {
    if (hint.re.test(haystack)) custom.add(hint.tag);
  }

  const baseName = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, "-");
  for (const part of baseName.split(/[-.\s]+/)) {
    const slug = slugifyTag(part);
    if (!slug || slug.length < 3 || slug === TAG_OTHERS) continue;
    if (appIds.has(slug)) continue;
    if (/^\d+$/.test(slug)) continue;
    custom.add(slug);
  }

  const tags = [];
  if (appId) tags.push(appId);
  else tags.push(TAG_OTHERS);
  for (const tag of custom) {
    if (!tags.includes(tag)) tags.push(tag);
  }

  return {
    tags: tags.slice(0, 8),
    appId,
    appTitle: suggested?.title || null,
    appUrl: suggested?.url || null,
    auto: true,
  };
}

export function collectCustomCategories(docs = [], apps = []) {
  const appIds = new Set((apps || []).map((app) => app.id));
  const counts = new Map();
  for (const doc of docs || []) {
    for (const raw of doc.tags || []) {
      const tag = String(raw || "").trim();
      if (!tag || tag === TAG_OTHERS || appIds.has(tag)) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export const IMPORT_ACCEPT =
  ".pdf,.csv,.txt,.text,.doc,.docx,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isKnowledgeImportFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    name.endsWith(".text") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}

export function isBlockedSpreadsheet(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  );
}

export function validateKnowledgeDraft(draft) {
  const title = String(draft?.title || "").trim();
  const content = String(draft?.content || "").trim();
  const tags = Array.isArray(draft?.tags) ? draft.tags.filter(Boolean) : [];
  if (!title) return "Judul wajib";
  if (!content) return "Konten wajib";
  if (content.length < MIN_KNOWLEDGE_CONTENT_CHARS) {
    return `Konten terlalu pendek (min ${MIN_KNOWLEDGE_CONTENT_CHARS} karakter)`;
  }
  if (content.length > MAX_KNOWLEDGE_CONTENT_CHARS) {
    return `Konten terlalu besar. Batas ${MAX_KNOWLEDGE_CONTENT_CHARS.toLocaleString("id-ID")} karakter — pecah dokumen, jangan dump massal.`;
  }
  if (!tags.length) {
    return "Tandai minimal satu aplikasi/Others atau kategori custom";
  }
  return "";
}

export function validateImportFile(file) {
  if (!file) return "Berkas wajib";
  if (isBlockedSpreadsheet(file)) {
    return "XLSX/XLS belum didukung. Export ke CSV (atau markdown table) lalu unggah.";
  }
  if (!isKnowledgeImportFile(file)) {
    return "Format: PDF, CSV, TXT, TEXT, DOC, atau DOCX";
  }
  if (file.size > MAX_KNOWLEDGE_IMPORT_BYTES) {
    return `Berkas lebih dari ${Math.round(MAX_KNOWLEDGE_IMPORT_BYTES / (1024 * 1024))} MB. Knowledge curated — potong berkas.`;
  }
  return "";
}
