/**
 * Proyeksi katalog yang aman untuk chatbot pengunjung B2C.
 * Harga B2B/channel dan angka stok per gudang tidak pernah ikut.
 */

export const PUBLIC_PRODUCT_FIELDS = [
  "No",
  "Description",
  "Description_2",
  "Description_3",
  "LongDescription",
  "Net_Weight",
  "Unit_Volume",
  "Barcode_Item",
  "Brand",
  "Item_Category_Code",
  "Manufacturer_Code",
  "organization",
  "updatedAt",
];

/** Field harga dan stok yang ada di product library. Dipakai tes kebocoran. */
export const SENSITIVE_PRODUCT_FIELDS = [
  "recgrosir",
  "_x003C_recretail_x003E_",
  "OS_Price",
  "MP_Price",
  "JD_Price",
  "Web",
  "LK",
  "NO_NIK",
  "TEMP",
  "Retail",
  "Dealer",
  "hash",
  "Inv_PRMT",
  "Inv_PLUIT",
  "Inv_MNG2",
  "Inv_BKS",
  "Inv_CKP",
  "Inv_CPDH",
  "Inv_GLD_F",
  "Inv_GLD",
  "Inv_SNTL",
  "Inv_SRNG",
  "Inv_MP",
  "Inv_OFFST",
  "Inv_PKJ",
  "Inv_prmt_OS",
  "Inv_pmrn",
  "Inv_cjrh",
  "Inv_Gab4Loc",
];

const INVENTORY_FIELDS = SENSITIVE_PRODUCT_FIELDS.filter((field) =>
  field.startsWith("Inv_"),
);

export function toPublicProduct(doc) {
  if (!doc || typeof doc !== "object") return null;
  const out = {};
  for (const field of PUBLIC_PRODUCT_FIELDS) {
    if (doc[field] !== undefined && doc[field] !== null) out[field] = doc[field];
  }
  return out;
}

export const LOCATION_STOCK_FIELDS = [
  ["PRMT", "Inv_PRMT"],
  ["PLUIT", "Inv_PLUIT"],
  ["MNG2", "Inv_MNG2"],
  ["BKS", "Inv_BKS"],
  ["CKP", "Inv_CKP"],
  ["CPDH", "Inv_CPDH"],
  ["GLD_F", "Inv_GLD_F"],
  ["GLD", "Inv_GLD"],
  ["SNTL", "Inv_SNTL"],
  ["SRNG", "Inv_SRNG"],
  ["MP", "Inv_MP"],
  ["OFFST", "Inv_OFFST"],
  ["PKJ", "Inv_PKJ"],
  ["prmt_OS", "Inv_prmt_OS"],
  ["pmrn", "Inv_pmrn"],
  ["cjrh", "Inv_cjrh"],
  ["Gab4Loc", "Inv_Gab4Loc"],
];

export function stockByLocation(doc) {
  return {
    No: doc?.No || null,
    Description: doc?.Description || null,
    organization: doc?.organization || null,
    Web: doc?.Web ?? null,
    locations: LOCATION_STOCK_FIELDS.map(([location, field]) => ({
      location,
      qty: Number(doc?.[field]) || 0,
    })),
    observedAt: doc?.updatedAt || null,
  };
}

export function availabilityFromProduct(doc) {
  const total = INVENTORY_FIELDS.reduce(
    (sum, field) => sum + (Number(doc?.[field]) || 0),
    0,
  );
  return {
    No: doc?.No || null,
    availability: total > 0 ? "available" : "unavailable",
    observedAt: doc?.updatedAt || null,
    detail: "coarse",
    note: "Ketersediaan kasar dari stok gudang. Angka persis dan harga tidak disertakan.",
  };
}

/** Dokumen howto publik. Technical dan dokumen tanpa visibility tetap internal. */
export function publicKnowledgeFilter() {
  return { visibility: "public" };
}
