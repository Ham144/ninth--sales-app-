import Product from "../models/product.model.js";
import Customer from "../models/Customer.model.js";
import SalesOrder from "../models/SalesOrder.model.js";
import Location from "../models/Location.model.js";
import OverDue from "../models/OverDue.model.js";
import escapeRegex from "../utils/excapeRegexInject.js";

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 8;
const MAX_UNWIND = 40;

const FILTER_OPS = new Set(["eq", "ne", "contains", "gt", "gte", "lt", "lte", "in", "between"]);
const METRIC_OPS = new Set(["count", "sum", "avg", "min", "max"]);
const FORBIDDEN_KEY_RE = /\$(?:where|function|accumulator|merge|out|lookup|unionWith|facet|currentOp|listSessions)\b/i;

const CUSTOMER_LOOKUP_FIELDS = ["No", "Name", "City"];

/** Staff read surface. Controlled text-to-Mongo, not a free shell. */
export const MONGO_READ_COLLECTIONS = {
  products: {
    model: Product,
    fields: [
      "No",
      "Description",
      "Description_2",
      "Brand",
      "Item_Category_Code",
      "organization",
      "Web",
      "Barcode_Item",
      "Blocked",
      "Inv_PRMT",
      "Inv_PLUIT",
      "Inv_MNG2",
      "Inv_BKS",
      "Inv_CKP",
      "updatedAt",
    ],
    filterFields: [
      "No",
      "Description",
      "Brand",
      "Item_Category_Code",
      "organization",
      "Web",
      "Barcode_Item",
      "Blocked",
    ],
    sortFields: ["No", "Description", "Web", "Brand", "updatedAt"],
    metricFields: ["Web"],
    dateFields: ["updatedAt", "createdAt"],
  },
  customers: {
    model: Customer,
    fields: [
      "No",
      "Name",
      "City",
      "Address",
      "Phone_No",
      "Salesperson_Code",
      "Customer_Price_Group",
      "Payment_Terms_Code",
      "Balance",
      "Balance_Due",
      "Credit_Limit_LCY",
      "Blocked",
      "Location_Code",
      "updatedAt",
    ],
    filterFields: [
      "No",
      "Name",
      "City",
      "Salesperson_Code",
      "Customer_Price_Group",
      "Blocked",
      "Location_Code",
    ],
    sortFields: ["No", "Name", "City", "Balance", "Balance_Due", "updatedAt"],
    metricFields: [],
    dateFields: ["updatedAt", "createdAt"],
  },
  sales_orders: {
    model: SalesOrder,
    fields: [
      "DocumentNo",
      "return_value",
      "OrderDate",
      "RequestDeliveryDate",
      "LocationCode",
      "SalespersonCode",
      "ExtDoc",
      "Keterangan",
      "SalesLineTotal",
      "status",
      "appSource",
      "createdAt",
      "updatedAt",
      "customerNo",
      "customerName",
      "customerCity",
    ],
    filterFields: [
      "DocumentNo",
      "return_value",
      "OrderDate",
      "RequestDeliveryDate",
      "LocationCode",
      "SalespersonCode",
      "ExtDoc",
      "status",
      "appSource",
      "SalesLineTotal",
      "createdAt",
      "customerNo",
      "customerName",
      "customerCity",
    ],
    sortFields: [
      "OrderDate",
      "createdAt",
      "SalesLineTotal",
      "DocumentNo",
      "SalespersonCode",
      "customerNo",
      "customerName",
    ],
    metricFields: ["SalesLineTotal"],
    dateFields: ["OrderDate", "RequestDeliveryDate", "createdAt", "updatedAt"],
    lookupCustomer: {
      kind: "objectId",
      localField: "customer",
    },
    line: {
      path: "SalesLine",
      fields: ["ItemNo", "Qty", "UnitPrice", "LineDiscountAmount", "PromoCode", "LineNo", "DocumentNo"],
      filterFields: ["ItemNo", "Qty", "UnitPrice", "PromoCode", "LineNo", "DocumentNo"],
      sortFields: ["ItemNo", "Qty", "UnitPrice", "LineNo"],
      metricFields: ["Qty", "UnitPrice", "LineDiscountAmount"],
    },
  },
  overdues: {
    model: OverDue,
    fields: [
      "customerNo",
      "documentNo",
      "postingDate",
      "dueDate",
      "salespersonCode",
      "remainingAmount",
      "AR",
      "blocked",
      "customerName",
      "customerCity",
    ],
    filterFields: [
      "customerNo",
      "documentNo",
      "postingDate",
      "dueDate",
      "salespersonCode",
      "remainingAmount",
      "blocked",
      "customerName",
      "customerCity",
    ],
    sortFields: ["dueDate", "remainingAmount", "postingDate", "customerNo", "customerName"],
    metricFields: ["remainingAmount"],
    dateFields: ["postingDate", "dueDate"],
    lookupCustomer: {
      kind: "customerNo",
      localField: "customerNo",
    },
  },
  locations: {
    model: Location,
    fields: ["name"],
    filterFields: ["name"],
    sortFields: ["name"],
    metricFields: [],
    dateFields: [],
  },
};

const CUSTOMER_ALIAS = {
  customerNo: "customerNo",
  customerName: "customerName",
  customerCity: "customerCity",
};

export function listMongoReadCollections() {
  return Object.entries(MONGO_READ_COLLECTIONS).map(([name, meta]) => ({
    name,
    fields: meta.fields,
    filterFields: meta.filterFields,
    sortFields: meta.sortFields,
    metricFields: meta.metricFields,
    supportsCustomerLookup: Boolean(meta.lookupCustomer),
    supportsLines: Boolean(meta.line),
  }));
}

function capLimit(value, max = MAX_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return Math.min(DEFAULT_LIMIT, max);
  return Math.min(Math.floor(n), max);
}

function isSafeFieldName(name) {
  return typeof name === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !name.startsWith("$");
}

/** Reject raw Mongo operators / write stages hidden in args. */
export function assertSafeMongoArgs(value, path = "args") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeMongoArgs(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("$") || FORBIDDEN_KEY_RE.test(key)) {
      throw new Error(`kunci berbahaya ditolak: ${path}.${key}`);
    }
    assertSafeMongoArgs(child, `${path}.${key}`);
  }
}

function coerceValue(field, value, dateFields) {
  if (value == null) return value;
  if (dateFields.includes(field)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`nilai tanggal tidak valid untuk ${field}`);
    }
    return date;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

function betweenBounds(field, value, dateFields) {
  let from;
  let to;
  if (Array.isArray(value) && value.length === 2) {
    [from, to] = value;
  } else if (value && typeof value === "object") {
    from = value.from ?? value.start ?? value.gte;
    to = value.to ?? value.end ?? value.lte;
  } else {
    throw new Error("between butuh [from,to] atau {from,to}");
  }
  return {
    $gte: coerceValue(field, from, dateFields),
    $lte: coerceValue(field, to, dateFields),
  };
}

function buildClause(field, op, value, dateFields) {
  if (!FILTER_OPS.has(op)) throw new Error(`operator tidak diizinkan: ${op}`);
  if (op === "contains") {
    return { [field]: { $regex: escapeRegex(String(value ?? "")), $options: "i" } };
  }
  if (op === "between") {
    return { [field]: betweenBounds(field, value, dateFields) };
  }
  if (op === "in") {
    const list = Array.isArray(value)
      ? value
      : String(value ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
    return { [field]: { $in: list.map((item) => coerceValue(field, item, dateFields)) } };
  }
  if (value !== undefined && typeof value === "object" && !Array.isArray(value)) {
    throw new Error("nilai filter objek tidak diizinkan");
  }
  const coerced = coerceValue(field, value, dateFields);
  if (op === "eq") return { [field]: coerced };
  if (op === "ne") return { [field]: { $ne: coerced } };
  if (op === "gt") return { [field]: { $gt: coerced } };
  if (op === "gte") return { [field]: { $gte: coerced } };
  if (op === "lt") return { [field]: { $lt: coerced } };
  if (op === "lte") return { [field]: { $lte: coerced } };
  throw new Error(`operator tidak diizinkan: ${op}`);
}

function resolveFilterField(meta, field) {
  if (meta.line && field.startsWith("line.")) {
    const lineField = field.slice(5);
    if (!meta.line.filterFields.includes(lineField)) {
      throw new Error(`field line tidak diizinkan: ${lineField}`);
    }
    return { kind: "line", field: `SalesLine.${lineField}`, raw: lineField };
  }
  if (CUSTOMER_ALIAS[field] && meta.lookupCustomer) {
    return { kind: "customer", field: CUSTOMER_ALIAS[field], raw: field };
  }
  if (!meta.filterFields.includes(field)) {
    throw new Error(`field filter tidak diizinkan: ${field || "(kosong)"}`);
  }
  return { kind: "base", field, raw: field };
}

export function buildMongoReadFilter(collectionName, filters = [], options = {}) {
  const meta = MONGO_READ_COLLECTIONS[collectionName];
  if (!meta) throw new Error(`koleksi tidak diizinkan: ${collectionName}`);
  const phase = options.phase || "base"; // base | customer | line
  const clauses = [];
  for (const raw of Array.isArray(filters) ? filters : []) {
    const fieldName = String(raw?.field || "").trim();
    const op = String(raw?.op || "eq").trim();
    if (fieldName.startsWith("line.")) {
      if (!isSafeFieldName(fieldName.slice(5))) {
        throw new Error(`field filter tidak diizinkan: ${fieldName || "(kosong)"}`);
      }
    } else if (!isSafeFieldName(fieldName)) {
      throw new Error(`field filter tidak diizinkan: ${fieldName || "(kosong)"}`);
    }
    const resolved = resolveFilterField(meta, fieldName);
    if (phase === "base" && resolved.kind !== "base") continue;
    if (phase === "customer" && resolved.kind !== "customer") continue;
    if (phase === "line" && resolved.kind !== "line") continue;

    const dateFields = resolved.kind === "base" ? meta.dateFields : [];
    const target =
      resolved.kind === "line"
        ? `SalesLine.${resolved.raw}`
        : resolved.kind === "customer"
          ? resolved.field
          : resolved.field;
    if (op !== "between" && raw?.value !== undefined && typeof raw.value === "object" && !Array.isArray(raw.value)) {
      throw new Error("nilai filter objek tidak diizinkan");
    }
    clauses.push(buildClause(target, op, raw?.value, dateFields));
  }
  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

/** @deprecated use phased filters; kept for tests — builds base-only match */
export function buildMongoReadFilterBase(collectionName, filters = []) {
  return buildMongoReadFilter(collectionName, filters, { phase: "base" });
}

export function buildMongoReadSort(collectionName, sort = [], options = {}) {
  const meta = MONGO_READ_COLLECTIONS[collectionName];
  if (!meta) throw new Error(`koleksi tidak diizinkan: ${collectionName}`);
  const afterLookup = Boolean(options.afterLookup);
  const afterUnwind = Boolean(options.afterUnwind);
  const allowed = new Set([
    ...meta.sortFields,
    ...(afterUnwind && meta.line ? meta.line.sortFields.map((f) => `line.${f}`) : []),
  ]);
  const out = {};
  for (const raw of Array.isArray(sort) ? sort : []) {
    let field = String(raw?.field || "").trim();
    if (field.startsWith("line.") && afterUnwind) {
      field = `SalesLine.${field.slice(5)}`;
      if (!meta.line?.sortFields.includes(field.slice("SalesLine.".length))) {
        throw new Error(`field sort line tidak diizinkan: ${raw.field}`);
      }
    } else if (CUSTOMER_ALIAS[field] && afterLookup) {
      field = CUSTOMER_ALIAS[field];
    } else if (!allowed.has(field) && !meta.sortFields.includes(field)) {
      throw new Error(`field sort tidak diizinkan: ${field || "(kosong)"}`);
    }
    if (!isSafeFieldName(field.replace(/\./g, "_")) && !field.includes(".")) {
      throw new Error(`field sort tidak diizinkan: ${field || "(kosong)"}`);
    }
    out[field] = String(raw?.dir || "asc").toLowerCase() === "desc" ? -1 : 1;
  }
  return out;
}

export function projectMongoReadFields(collectionName, fields, options = {}) {
  const meta = MONGO_READ_COLLECTIONS[collectionName];
  const allowed = new Set(meta.fields);
  if (options.includeLines && meta.line) {
    for (const field of meta.line.fields) allowed.add(`line.${field}`);
  }
  const requested = Array.isArray(fields) && fields.length
    ? fields.map((field) => String(field).trim()).filter((field) => allowed.has(field) || field.startsWith("line."))
    : meta.fields.filter((field) => !["customerNo", "customerName", "customerCity"].includes(field) || options.includeCustomer);
  const projection = { _id: 0 };
  const outFields = [];
  for (const field of requested.length ? requested : meta.fields) {
    if (field.startsWith("line.") && options.includeLines) {
      const lineField = field.slice(5);
      projection[`SalesLine.${lineField}`] = 1;
      outFields.push(field);
      continue;
    }
    if (["customerNo", "customerName", "customerCity"].includes(field)) {
      if (!options.includeCustomer) continue;
      projection[field] = 1;
      outFields.push(field);
      continue;
    }
    if (!allowed.has(field) && !meta.fields.includes(field)) continue;
    projection[field] = 1;
    outFields.push(field);
  }
  if (options.includeCustomer) {
    for (const alias of ["customerNo", "customerName", "customerCity"]) {
      if (!outFields.includes(alias) && meta.fields.includes(alias)) {
        projection[alias] = 1;
        outFields.push(alias);
      }
    }
  }
  if (options.includeLines && meta.line) {
    projection.SalesLine = 1;
  }
  return { projection, fields: outFields };
}

function needsCustomerLookup(meta, args) {
  if (!meta.lookupCustomer) return false;
  if (args.includeCustomer === true || args.includeCustomer === "true") return true;
  const filters = Array.isArray(args.filters) ? args.filters : [];
  return filters.some((item) => CUSTOMER_ALIAS[String(item?.field || "").trim()]);
}

function needsUnwind(meta, args) {
  if (!meta.line) return false;
  if (args.unwindLines === true || args.unwindLines === "true" || args.mode === "lines") return true;
  const filters = Array.isArray(args.filters) ? args.filters : [];
  return filters.some((item) => String(item?.field || "").startsWith("line."));
}

function customerLookupStages(meta) {
  const cfg = meta.lookupCustomer;
  const from = Customer.collection.name;
  if (cfg.kind === "objectId") {
    return [
      {
        $lookup: {
          from,
          localField: cfg.localField,
          foreignField: "_id",
          as: "_customer",
        },
      },
      {
        $addFields: {
          _customerOne: { $arrayElemAt: ["$_customer", 0] },
        },
      },
      {
        $addFields: {
          customerNo: "$_customerOne.No",
          customerName: "$_customerOne.Name",
          customerCity: "$_customerOne.City",
        },
      },
      { $project: { _customer: 0, _customerOne: 0 } },
    ];
  }
  return [
    {
      $lookup: {
        from,
        let: { cno: { $toString: `$${cfg.localField}` } },
        pipeline: [
          { $match: { $expr: { $eq: ["$No", "$$cno"] } } },
          { $project: { No: 1, Name: 1, City: 1, _id: 0 } },
        ],
        as: "_customer",
      },
    },
    {
      $addFields: {
        _customerOne: { $arrayElemAt: ["$_customer", 0] },
      },
    },
    {
      $addFields: {
        customerName: "$_customerOne.Name",
        customerCity: "$_customerOne.City",
      },
    },
    { $project: { _customer: 0, _customerOne: 0 } },
  ];
}

function metricKey(op, field) {
  if (op === "count") return "count";
  return `${op}_${field}`;
}

function buildGroupMetrics(meta, metrics, options = {}) {
  const metricFields = options.line
    ? meta.line.metricFields
    : meta.metricFields || meta.sumFields || [];
  const list = Array.isArray(metrics) && metrics.length ? metrics : [{ op: "count" }];
  const group = {};
  const outKeys = [];
  for (const metric of list) {
    const op = String(metric?.op || "").trim();
    if (!METRIC_OPS.has(op)) throw new Error(`metric tidak diizinkan: ${op}`);
    if (op === "count") {
      group.count = { $sum: 1 };
      outKeys.push("count");
      continue;
    }
    const field = String(metric?.field || "").trim();
    const path = options.line ? `SalesLine.${field}` : field;
    if (!metricFields.includes(field)) {
      throw new Error(`field metric tidak diizinkan: ${field || "(kosong)"}`);
    }
    const key = metricKey(op, field);
    if (op === "sum") group[key] = { $sum: `$${path}` };
    if (op === "avg") group[key] = { $avg: `$${path}` };
    if (op === "min") group[key] = { $min: `$${path}` };
    if (op === "max") group[key] = { $max: `$${path}` };
    outKeys.push(key);
  }
  return { group, outKeys };
}

function flattenLineRow(row, headerFields, lineFields) {
  const out = {};
  for (const field of headerFields) {
    if (["customerNo", "customerName", "customerCity"].includes(field) || row[field] !== undefined) {
      if (row[field] !== undefined) out[field] = row[field];
    }
  }
  const line = row.SalesLine || {};
  for (const field of lineFields) {
    if (line[field] !== undefined) out[field] = line[field];
  }
  return out;
}

export function buildMongoReadPipeline(collectionName, args = {}) {
  assertSafeMongoArgs(args);
  const meta = MONGO_READ_COLLECTIONS[collectionName];
  if (!meta) throw new Error(`koleksi tidak diizinkan: ${collectionName}`);

  const mode = String(args.mode || "find").trim().toLowerCase();
  const withCustomer = needsCustomerLookup(meta, args);
  const withLines = needsUnwind(meta, args);
  if (withLines && !meta.line) throw new Error("koleksi ini tidak mendukung unwind lines");
  if (mode === "aggregate" && withLines) {
    throw new Error("mode aggregate tidak digabung unwind lines; pakai mode lines atau find+unwindLines");
  }

  const limit = capLimit(args.limit, withLines ? MAX_UNWIND : MAX_LIMIT);
  const baseMatch = buildMongoReadFilter(collectionName, args.filters, { phase: "base" });
  const pipeline = [];
  if (Object.keys(baseMatch).length) pipeline.push({ $match: baseMatch });

  if (withCustomer) {
    pipeline.push(...customerLookupStages(meta));
    const customerMatch = buildMongoReadFilter(collectionName, args.filters, { phase: "customer" });
    if (Object.keys(customerMatch).length) pipeline.push({ $match: customerMatch });
  }

  if (withLines) {
    pipeline.push({ $unwind: { path: "$SalesLine", preserveNullAndEmptyArrays: false } });
    const lineMatch = buildMongoReadFilter(collectionName, args.filters, { phase: "line" });
    if (Object.keys(lineMatch).length) pipeline.push({ $match: lineMatch });
  }

  if (mode === "aggregate") {
    const groupFields = Array.isArray(args.groupBy) ? args.groupBy : [];
    if (!groupFields.length) throw new Error("groupBy wajib untuk mode aggregate");
    const id = {};
    for (const field of groupFields) {
      const name = String(field || "").trim();
      const ok =
        meta.filterFields.includes(name) ||
        meta.sortFields.includes(name) ||
        meta.fields.includes(name) ||
        (withCustomer && CUSTOMER_ALIAS[name]);
      if (!isSafeFieldName(name) || !ok) {
        throw new Error(`field groupBy tidak diizinkan: ${name || "(kosong)"}`);
      }
      id[name] = `$${name}`;
    }
    const { group: metricGroup, outKeys } = buildGroupMetrics(meta, args.metrics, { line: false });
    const group = { _id: id, ...metricGroup };
    pipeline.push({ $group: group });

    const sort = {};
    for (const raw of Array.isArray(args.sort) ? args.sort : []) {
      const field = String(raw?.field || "").trim();
      const dir = String(raw?.dir || "desc").toLowerCase() === "asc" ? 1 : -1;
      if (outKeys.includes(field)) sort[field] = dir;
      else if (groupFields.includes(field)) sort[`_id.${field}`] = dir;
    }
    if (!Object.keys(sort).length && group.count) sort.count = -1;
    if (Object.keys(sort).length) pipeline.push({ $sort: sort });
    pipeline.push({ $limit: limit });
    return {
      pipeline,
      limit,
      mode: "aggregate",
      withCustomer,
      withLines: false,
      groupFields,
      metricKeys: outKeys,
    };
  }

  const sort = buildMongoReadSort(collectionName, args.sort, {
    afterLookup: withCustomer,
    afterUnwind: withLines,
  });
  if (Object.keys(sort).length) pipeline.push({ $sort: sort });
  pipeline.push({ $limit: limit });

  const { fields } = projectMongoReadFields(collectionName, args.fields, {
    includeCustomer: withCustomer,
    includeLines: withLines,
  });

  const project = { _id: 0 };
  for (const field of fields) {
    if (field.startsWith("line.")) continue;
    project[field] = 1;
  }
  if (withLines) {
    project.SalesLine = {};
    for (const field of meta.line.fields) {
      project.SalesLine[field] = 1;
    }
    // Also keep useful headers
    for (const field of ["DocumentNo", "return_value", "OrderDate", "SalespersonCode", "LocationCode", "status"]) {
      if (meta.fields.includes(field) || field === "DocumentNo") project[field] = 1;
    }
    if (withCustomer) {
      project.customerNo = 1;
      project.customerName = 1;
      project.customerCity = 1;
    }
  }
  pipeline.push({ $project: project });

  return {
    pipeline,
    limit,
    mode: withLines ? "lines" : "find",
    withCustomer,
    withLines,
    fields,
    lineFields: meta.line?.fields || [],
  };
}

async function runPipeline(meta, collectionName, args) {
  const built = buildMongoReadPipeline(collectionName, args);
  const rows = await meta.model.aggregate(built.pipeline).allowDiskUse(false);

  if (built.mode === "aggregate") {
    const data = rows.map((row) => {
      const item = {};
      for (const field of built.groupFields) item[field] = row._id?.[field];
      for (const key of built.metricKeys) {
        if (row[key] != null) item[key] = row[key];
      }
      return item;
    });
    return {
      collection: collectionName,
      mode: "aggregate",
      returned: data.length,
      limit: built.limit,
      data,
      note: "Level B read-only aggregate. Bukan status NAV live, bukan tulis, bukan export massal.",
    };
  }

  if (built.withLines) {
    const headerFields = [
      "DocumentNo",
      "return_value",
      "OrderDate",
      "SalespersonCode",
      "LocationCode",
      "status",
      "customerNo",
      "customerName",
      "customerCity",
    ];
    const data = rows.map((row) => flattenLineRow(row, headerFields, built.lineFields));
    return {
      collection: collectionName,
      mode: "lines",
      returned: data.length,
      limit: built.limit,
      data,
      note: "Level B unwind SalesLine (cap). Bukan status NAV live dan bukan tulis.",
    };
  }

  const data = rows.map((row) => {
    const out = {};
    for (const field of built.fields) {
      if (row[field] !== undefined) out[field] = row[field];
    }
    return out;
  });

  // total only when cheap find without lookup/unwind
  let total;
  if (!built.withCustomer && !built.withLines) {
    const baseMatch = buildMongoReadFilter(collectionName, args.filters, { phase: "base" });
    total = await meta.model.countDocuments(baseMatch);
  }

  return {
    collection: collectionName,
    mode: "find",
    ...(total != null ? { total } : {}),
    returned: data.length,
    limit: built.limit,
    data,
    note: built.withCustomer
      ? "Level B find + lookup customer. Bukan status NAV live dan bukan tulis."
      : "Level B read-only Hub Mongo. Bukan status NAV live dan bukan tulis.",
  };
}

/**
 * Allowlisted Hub Mongo read (Level B). Rejects unknown collections, $-fields, and writes.
 */
export async function runMongoRead(args = {}) {
  try {
    assertSafeMongoArgs(args);
  } catch (error) {
    return { error: error.message || "query ditolak" };
  }
  const collectionName = String(args.collection || "").trim();
  const meta = MONGO_READ_COLLECTIONS[collectionName];
  if (!meta) {
    return {
      error: "koleksi tidak diizinkan",
      collections: listMongoReadCollections().map((item) => item.name),
    };
  }
  const mode = String(args.mode || "find").trim().toLowerCase();
  try {
    if (!["find", "aggregate", "lines"].includes(mode)) {
      return { error: `mode tidak diizinkan: ${mode}`, collection: collectionName };
    }
    return await runPipeline(meta, collectionName, args);
  } catch (error) {
    return { error: error.message || "query ditolak", collection: collectionName };
  }
}

// Back-compat export used by older tests expecting sumFields naming in list
export function getMetricFields(collectionName) {
  return MONGO_READ_COLLECTIONS[collectionName]?.metricFields || [];
}
