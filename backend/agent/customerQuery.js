import escapeRegex from "../utils/excapeRegexInject.js";

const STRING_FIELDS = [
  "No",
  "Name",
  "City",
  "Phone_No",
  "Customer_Price_Group",
  "Salesperson_Code",
  "Blocked",
  "Location_Code",
];

const NUMERIC_FIELDS = ["Balance", "Balance_Due", "Credit_Limit_LCY"];

export const CUSTOMER_SORT_FIELDS = [...NUMERIC_FIELDS, "Name", "City", "No"];
export const CUSTOMER_FILTER_FIELDS = [...STRING_FIELDS, ...NUMERIC_FIELDS];
export const CUSTOMER_FILTER_OPS = ["eq", "contains", "gt", "gte", "lt", "lte"];

const RANKING_RE =
  /(saldo|balance|limit\s*kredit|credit\s*limit|plafon)[^\n]{0,20}(terbesar|tertinggi|terkecil|terendah|paling\s+(besar|kecil|tinggi|rendah))/i;
const PIUTANG_RE = /\b(piutang|overdue)\b/i;
const STOP_RE =
  /\b(customer|pelanggan|toko|dengan|yang|secara|keseluruhan|paling|terbesar|tertinggi|terkecil|terendah|besar|kecil|tinggi|rendah)\b/gi;

function isPlainScalar(value) {
  return value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function fieldKind(field) {
  if (NUMERIC_FIELDS.includes(field)) return "number";
  if (STRING_FIELDS.includes(field)) return "string";
  return "";
}

function toDoubleExpr(field) {
  return { $convert: { input: `$${field}`, to: "double", onError: 0, onNull: 0 } };
}

function numericOp(path, op, n) {
  if (op === "eq") return { [path]: n };
  if (op === "gt") return { [path]: { $gt: n } };
  if (op === "gte") return { [path]: { $gte: n } };
  if (op === "lt") return { [path]: { $lt: n } };
  if (op === "lte") return { [path]: { $lte: n } };
  return null;
}

function rankingField(text) {
  if (/limit\s*kredit|credit\s*limit|plafon/i.test(text)) return "Credit_Limit_LCY";
  if (/saldo\s*jatuh|balance[_\s]*due/i.test(text)) return "Balance_Due";
  if (/saldo|balance/i.test(text)) return "Balance";
  return "";
}

function filterClause(raw) {
  const field = String(raw?.field || "").trim();
  const op = String(raw?.op || "eq").trim();
  const kind = fieldKind(field);
  if (!kind) return { error: `field ${raw?.field || "?"} tidak diizinkan` };
  if (!CUSTOMER_FILTER_OPS.includes(op)) return { error: `op ${op} tidak diizinkan` };
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

export function customerTextQuery(searchKey) {
  const key = String(searchKey || "").trim();
  const escaped = escapeRegex(key);
  if (/^\d{4,}$/.test(key)) {
    return {
      $or: [
        { No: key },
        { No: { $regex: `^${escaped}` } },
        { Phone_No: { $regex: escaped } },
        { HP_No: { $regex: escaped } },
      ],
    };
  }
  return {
    $or: [
      { No: { $regex: escaped, $options: "i" } },
      { Name: { $regex: escaped, $options: "i" } },
      { City: { $regex: escaped, $options: "i" } },
    ],
  };
}

export function interpretCustomerRanking(args = {}) {
  const original = String(args.query || args.searchKey || "").trim();
  let sortBy = CUSTOMER_SORT_FIELDS.includes(args.sortBy) ? args.sortBy : "";
  let sortDir = args.sortDir === "asc" ? "asc" : args.sortDir === "desc" ? "desc" : "";
  let searchKey = original;

  if (PIUTANG_RE.test(original) && !rankingField(original)) {
    return {
      searchKey: original,
      sortBy: "",
      sortDir: "",
      useOverdue: true,
    };
  }

  if (RANKING_RE.test(original) || rankingField(original)) {
    if (!sortBy) sortBy = rankingField(original) || "Balance";
    if (!sortDir) {
      sortDir = /terkecil|terendah|paling\s+(kecil|rendah)/i.test(original) ? "asc" : "desc";
    }
    searchKey = searchKey.replace(RANKING_RE, " ").replace(STOP_RE, " ").replace(/\s+/g, " ").trim();
  }
  if (searchKey.length < 2) searchKey = "";
  return { searchKey, sortBy, sortDir, useOverdue: false };
}

export function compileCustomerQuery(args = {}) {
  const interpreted = interpretCustomerRanking(args);
  if (interpreted.useOverdue) {
    return {
      error: "Piutang dokumen memakai overdue_lookup. Master customer tidak berisi sisa faktur overdue.",
    };
  }

  let searchKey = interpreted.searchKey;
  const sortBy = interpreted.sortBy;
  const sortDir = interpreted.sortDir || (sortBy ? "desc" : "");
  const filters = Array.isArray(args.filters) ? args.filters.slice(0, 8) : [];
  const itemNo = String(args.no || args.customerNo || "").trim();
  const city = String(args.city || "").trim();
  const limit = Math.min(Math.max(Number(args.limit) || (sortBy && !searchKey && !itemNo ? 5 : 8), 1), 8);

  if (itemNo) {
    filters.unshift({ field: "No", op: "eq", value: itemNo });
    searchKey = "";
  }
  if (city) filters.push({ field: "City", op: "contains", value: city });

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
    return { message: "Isi query, no, sortBy, atau filters" };
  }

  const sort = sortBy ? { [sortBy]: sortDir === "asc" ? 1 : -1 } : null;
  if (sort && NUMERIC_FIELDS.includes(sortBy) && !numericFilters.some((item) => item.field === sortBy)) {
    numericFilters.push({ field: sortBy, op: "gt", n: 0 });
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
    scope,
    note:
      scope === "catalog"
        ? "Peringkat master customer. Bukan total dokumen overdue."
        : scope === "item"
          ? "Lookup nomor customer persis."
          : "Customer yang teksnya cocok dengan query.",
  };
}

function projectionFromSelect(select) {
  const fields = typeof select === "string" ? select.split(/\s+/).filter(Boolean) : select;
  const projection = { _id: 0 };
  for (const field of fields || []) projection[field] = 1;
  return projection;
}

export async function runCustomerQuery(Customer, args, { select } = {}) {
  const compiled = compileCustomerQuery(args);
  if (compiled.error || compiled.message) return compiled;

  const clauses = [];
  if (compiled.textKey.length >= 2) clauses.push(customerTextQuery(compiled.textKey));
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

  const [agg] = await Customer.aggregate([
    { $match: match },
    { $addFields: addFields },
    { $facet: { rows: rowsPipe, total: totalPipe } },
  ]);

  return {
    rows: agg?.rows || [],
    total: agg?.total?.[0]?.n || 0,
    scope: compiled.scope,
    note: compiled.note,
  };
}
