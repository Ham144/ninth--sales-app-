import escapeRegex from "../utils/excapeRegexInject.js";
import { LOCATION_STOCK_FIELDS } from "../utils/publicCatalog.js";

const STRING_FIELDS = [
  "No",
  "Description",
  "Description_2",
  "Description_3",
  "Brand",
  "Item_Category_Code",
  "Manufacturer_Code",
  "Barcode_Item",
  "Blocked",
];

const STOCK_FIELDS = LOCATION_STOCK_FIELDS.map(([, field]) => field);
const NUMERIC_FIELDS = ["Web", ...STOCK_FIELDS];

const LOCATION_ALIASES = {
  pluit: "Inv_PLUIT",
  permata: "Inv_PRMT",
  prmt: "Inv_PRMT",
  "mangga dua": "Inv_MNG2",
  manggadua: "Inv_MNG2",
  mng2: "Inv_MNG2",
  bekasi: "Inv_BKS",
  bks: "Inv_BKS",
  cakung: "Inv_CKP",
  ckp: "Inv_CKP",
  cipadah: "Inv_CPDH",
  cpdh: "Inv_CPDH",
  gudang: "Inv_GLD",
  gld: "Inv_GLD",
  "gudang f": "Inv_GLD_F",
  sentul: "Inv_SNTL",
  sntl: "Inv_SNTL",
  serpong: "Inv_SRNG",
  srng: "Inv_SRNG",
  mp: "Inv_MP",
  offset: "Inv_OFFST",
  offst: "Inv_OFFST",
  pik: "Inv_PKJ",
  pkj: "Inv_PKJ",
};

export const PRODUCT_FILTER_OPS = ["eq", "contains", "gt", "gte", "lt", "lte"];
export const PRODUCT_SORT_FIELDS = [
  "Web",
  "No",
  "Description",
  "Brand",
  ...LOCATION_STOCK_FIELDS.map(([code]) => code),
];
export const PRODUCT_FILTER_FIELDS = [
  ...STRING_FIELDS,
  "Web",
  ...LOCATION_STOCK_FIELDS.map(([code]) => code),
];

const RANKING_RE =
  /(harga\s*)?(web\s*)?(tertinggi|terendah|termahal|termurah|paling\s+(mahal|murah))/i;
const STOCK_RANK_RE = /(stok|inventory|persediaan).{0,24}(terbanyak|tersedikit|paling\s+(banyak|sedikit))/i;
const STOP_RE =
  /\b(produk|barang|dengan|yang|secara|keseluruhan|seluruh|katalog|di|dari|untuk|adalah|paling|stok|inventory|persediaan|terbanyak|tersedikit|banyak|sedikit)\b/gi;

function isPlainScalar(value) {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function canonicalProductField(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  if (STRING_FIELDS.includes(raw) || NUMERIC_FIELDS.includes(raw)) return raw;
  const alias = LOCATION_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const loc = LOCATION_STOCK_FIELDS.find(([code]) => code.toLowerCase() === raw.toLowerCase());
  return loc ? loc[1] : "";
}

function fieldKind(field) {
  if (NUMERIC_FIELDS.includes(field)) return "number";
  if (STRING_FIELDS.includes(field)) return "string";
  return "";
}

function toDoubleExpr(field) {
  return { $convert: { input: `$${field}`, to: "double", onError: 0, onNull: 0 } };
}

function detectLocationField(text) {
  const lower = ` ${String(text || "").toLowerCase()} `;
  const aliases = Object.entries(LOCATION_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, field] of aliases) {
    if (lower.includes(` ${alias} `) || lower.includes(` ${alias.replace(/\s+/g, "")} `)) return field;
  }
  for (const [code, field] of LOCATION_STOCK_FIELDS) {
    if (lower.includes(` ${code.toLowerCase()} `)) return field;
  }
  return "";
}

function filterClause(raw) {
  const field = canonicalProductField(raw?.field);
  const op = String(raw?.op || "eq").trim();
  const kind = fieldKind(field);
  if (!kind) return { error: `field ${raw?.field || "?"} tidak diizinkan` };
  if (!PRODUCT_FILTER_OPS.includes(op)) return { error: `op ${op} tidak diizinkan` };
  if (!isPlainScalar(raw?.value)) return { error: "value filter tidak valid" };
  if (kind === "number") {
    const n = parseNumber(raw.value);
    if (n === null) return { error: `${field} harus angka` };
    if (op === "contains") return { error: `${field} tidak memakai contains` };
    return { numeric: { field, op, n } };
  }
  const text = String(raw.value ?? "").trim();
  if (!text || text.length > 80) return { error: "value teks terlalu panjang atau kosong" };
  if (text.includes("$")) return { error: "value tidak valid" };
  if (op === "eq") return { clause: { [field]: text } };
  if (op === "contains") {
    return { clause: { [field]: { $regex: escapeRegex(text), $options: "i" } } };
  }
  return { error: `${field} hanya eq atau contains` };
}

function numericOp(path, op, n) {
  if (op === "eq") return { [path]: n };
  if (op === "gt") return { [path]: { $gt: n } };
  if (op === "gte") return { [path]: { $gte: n } };
  if (op === "lt") return { [path]: { $lt: n } };
  if (op === "lte") return { [path]: { $lte: n } };
  return null;
}

export function productTextQuery(searchKey) {
  const key = String(searchKey || "").trim();
  const escaped = escapeRegex(key);
  if (/^\d{8,}$/.test(key)) {
    return { Barcode_Item: { $regex: `^${escaped}`, $options: "i" } };
  }
  if (key.length === 2) return { No: { $regex: `^${escaped}$`, $options: "i" } };
  if (/^[A-Za-z0-9]+-?[A-Za-z0-9-]*\d[A-Za-z0-9-]*$/.test(key) && key.length >= 3 && !/\s/.test(key)) {
    return {
      $or: [
        { No: { $regex: `^${escaped}$`, $options: "i" } },
        { No: { $regex: escaped, $options: "i" } },
        { Barcode_Item: { $regex: escaped, $options: "i" } },
      ],
    };
  }
  const word = { $regex: `\\b${escaped}\\b`, $options: "i" };
  const contains = { $regex: escaped, $options: "i" };
  return {
    $or: [
      { No: contains },
      { Description: word },
      { Description_2: word },
      { Description_3: word },
      { Brand: word },
      { Barcode_Item: contains },
    ],
  };
}

export function interpretProductRanking(args = {}) {
  const original = String(args.searchKey || args.q || "").trim();
  let sortBy = canonicalProductField(args.sortBy);
  let sortDir = args.sortDir === "asc" ? "asc" : args.sortDir === "desc" ? "desc" : "";
  if (args.sort === "web_desc") {
    sortBy = sortBy || "Web";
    sortDir = sortDir || "desc";
  }
  if (args.sort === "web_asc") {
    sortBy = sortBy || "Web";
    sortDir = sortDir || "asc";
  }
  let searchKey = original;
  if (RANKING_RE.test(searchKey)) {
    if (!sortBy) sortBy = "Web";
    if (!sortDir) sortDir = /terendah|termurah|paling\s+murah/i.test(searchKey) ? "asc" : "desc";
    searchKey = searchKey.replace(RANKING_RE, " ").replace(STOP_RE, " ").replace(/\s+/g, " ").trim();
  }
  if (STOCK_RANK_RE.test(original) || (detectLocationField(original) && /stok|inventory/i.test(original))) {
    const loc = detectLocationField(original);
    if (loc && !sortBy) sortBy = loc;
    if (loc && !sortDir) {
      sortDir = /tersedikit|paling\s+sedikit/i.test(original) ? "asc" : "desc";
    }
    searchKey = searchKey.replace(STOCK_RANK_RE, " ").replace(STOP_RE, " ").replace(/\s+/g, " ").trim();
    const locName = Object.keys(LOCATION_ALIASES).find((alias) => LOCATION_ALIASES[alias] === loc);
    if (locName) searchKey = searchKey.replace(new RegExp(`\\b${escapeRegex(locName)}\\b`, "ig"), " ").trim();
  }
  if (searchKey.length < 2) searchKey = "";
  return { searchKey, sortBy, sortDir };
}

export function compileProductQuery(args = {}, { allowCatalogQuery = true } = {}) {
  const interpreted = interpretProductRanking(args);
  let searchKey = interpreted.searchKey;
  let sortBy = interpreted.sortBy;
  let sortDir = interpreted.sortDir || (sortBy ? "desc" : "");
  const filters = Array.isArray(args.filters) ? args.filters.slice(0, 8) : [];
  const itemNo = String(args.no || "").trim();
  const view = args.view === "stock" ? "stock" : "list";
  const limit = Math.min(Math.max(Number(args.limit) || (sortBy && !searchKey && !itemNo ? 5 : 8), 1), 8);

  if (itemNo) {
    filters.unshift({ field: "No", op: "eq", value: itemNo });
    searchKey = "";
  }

  if (!allowCatalogQuery) {
    if (searchKey.length < 2 && !itemNo) return { message: "searchKey minimal 2 karakter" };
    return {
      searchKey,
      extraClauses: itemNo ? [{ No: itemNo }] : [],
      numericFilters: [],
      textKey: searchKey,
      sort: null,
      sortBy: "",
      sortDir: "",
      limit,
      view: "list",
      scope: "search",
      note: "Hanya produk yang teksnya cocok dengan searchKey. Bukan seluruh katalog.",
    };
  }

  const extraClauses = [];
  const numericFilters = [];
  for (const item of filters) {
    const next = filterClause(item);
    if (next.error) return { error: next.error };
    if (next.numeric) numericFilters.push(next.numeric);
    else extraClauses.push(next.clause);
  }

  if (searchKey.length < 2) searchKey = "";
  if (searchKey.length < 2 && !sortBy && !extraClauses.length && !numericFilters.length) {
    return { message: "Isi searchKey, no, sortBy, atau filters" };
  }

  if (sortBy && !NUMERIC_FIELDS.includes(sortBy) && !STRING_FIELDS.includes(sortBy)) {
    return { error: `sortBy ${sortBy} tidak diizinkan` };
  }

  const sort = sortBy ? { [sortBy]: sortDir === "asc" ? 1 : -1 } : null;
  if (sort?.Web && !numericFilters.some((item) => item.field === "Web")) {
    numericFilters.push({ field: "Web", op: "gt", n: 0 });
  }
  const scope = searchKey.length >= 2 ? "search" : itemNo ? "item" : "catalog";

  return {
    searchKey,
    extraClauses,
    numericFilters,
    textKey: searchKey,
    sort,
    sortBy: sort ? sortBy : "",
    sortDir: sort ? sortDir : "",
    limit,
    view,
    scope,
    note:
      scope === "catalog"
        ? sortBy === "Web"
          ? "Peringkat harga Web seluruh katalog yang tersimpan."
          : "Query katalog tanpa kata kunci produk. Stok lokasi diurutkan sebagai angka."
        : scope === "item"
          ? "Lookup nomor item persis."
          : "Hanya produk yang teksnya cocok dengan searchKey. Bukan seluruh katalog.",
  };
}

function projectionFromSelect(select) {
  const fields = typeof select === "string" ? select.split(/\s+/).filter(Boolean) : select;
  const projection = { _id: 0 };
  for (const field of fields || []) projection[field] = 1;
  return projection;
}

export async function runProductQuery(
  Product,
  args,
  { allowCatalogQuery = true, organizationClause = null, select } = {},
) {
  if (organizationClause?.invalid) return { error: "organization harus csi atau ril" };
  const compiled = compileProductQuery(args, { allowCatalogQuery });
  if (compiled.error || compiled.message) return compiled;

  const clauses = [];
  if (organizationClause) clauses.push(organizationClause);
  if (compiled.textKey.length >= 2) clauses.push(productTextQuery(compiled.textKey));
  clauses.push(...compiled.extraClauses);
  const match = !clauses.length ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };

  const addFields = {};
  for (const field of NUMERIC_FIELDS) addFields[`_n_${field}`] = toDoubleExpr(field);

  const numericMatch = {};
  for (const item of compiled.numericFilters) {
    Object.assign(numericMatch, numericOp(`_n_${item.field}`, item.op, item.n));
  }

  let sortStage = null;
  if (compiled.sort) {
    const [field, dir] = Object.entries(compiled.sort)[0];
    const key = NUMERIC_FIELDS.includes(field) ? `_n_${field}` : field;
    sortStage = { [key]: dir };
  }

  const projection = projectionFromSelect(select);
  const rowsPipe = [];
  if (Object.keys(numericMatch).length) rowsPipe.push({ $match: numericMatch });
  if (sortStage) rowsPipe.push({ $sort: sortStage });
  rowsPipe.push({ $limit: compiled.limit });
  if (Object.keys(projection).length > 1) rowsPipe.push({ $project: projection });

  const totalPipe = Object.keys(numericMatch).length
    ? [{ $match: numericMatch }, { $count: "n" }]
    : [{ $count: "n" }];

  const [agg] = await Product.aggregate([
    { $match: match },
    { $addFields: addFields },
    {
      $facet: {
        rows: rowsPipe,
        total: totalPipe,
      },
    },
  ]);

  return {
    rows: agg?.rows || [],
    total: agg?.total?.[0]?.n || 0,
    scope: compiled.scope,
    note: compiled.note,
    view: compiled.view,
  };
}
