import { connectDB } from "./connectDB.js";
import "dotenv/config";
import cron from "node-cron";
import { checkInventoryXML, checkStockXML, productXml } from "../xml.js";
import { fetchData } from "./soap-util.js";
import "dotenv/config";
import xml2js from "xml2js";
import crypto from "crypto";
import Product from "../models/product.model.js";
import Org from "../models/Organization.model.js";
import { PRODUCT_ORGANIZATIONS } from "./productOrganization.js";

function hashProductData(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const fetchingSoapToGetStock = async (No, locationCode, req) => {
  try {
    const org = await Org.findOne().select(
      "SOAP_STOCK_URL SOAP_STOCK_USERNAME SOAP_STOCK_PASSWORD SOAP_STOCK_SOAPACTION SOAP_STOCK_XMLNS",
    );

    const {
      SOAP_STOCK_URL,
      SOAP_STOCK_USERNAME,
      SOAP_STOCK_PASSWORD,
      SOAP_STOCK_SOAPACTION,
      SOAP_STOCK_XMLNS,
    } = org;

    if (
      !SOAP_STOCK_URL ||
      !SOAP_STOCK_USERNAME ||
      !SOAP_STOCK_PASSWORD ||
      !SOAP_STOCK_SOAPACTION ||
      !SOAP_STOCK_XMLNS
    ) {
      console.log("Konfigurasi soap stock tidak lengkap");
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: checkStockXML(No, locationCode, SOAP_STOCK_XMLNS), // <-- XML generator khusus produk
      username: SOAP_STOCK_USERNAME,
      password: SOAP_STOCK_PASSWORD,
      url: SOAP_STOCK_URL,
      SOAPAction: SOAP_STOCK_SOAPACTION,
    });
    if (!rawXmlResponse) {
      console.log("Response kosong");
      return null;
    }

    const parsed = await xml2js.parseStringPromise(rawXmlResponse, {
      explicitArray: false,
      trim: true,
    });

    const body = parsed?.["Soap:Envelope"]?.["Soap:Body"];

    if (!body) {
      console.log("Tidak bisa menemukan data hasil");
      return null;
    }
    
    const inventoryValue = body?.GetInventoryByLocation_Result?.inventory;
    return inventoryValue !== undefined ? Number(inventoryValue) : null;
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

export const fetchingSoapToGetInventory = async (No, locationCode, req) => {
  try {
    const org = await Org.findOne().select(
      "SOAP_INVENTORY_URL SOAP_INVENTORY_USERNAME SOAP_INVENTORY_PASSWORD SOAP_INVENTORY_SOAPACTION SOAP_INVENTORY_XMLNS",
    );

    const {
      SOAP_INVENTORY_URL,
      SOAP_INVENTORY_USERNAME,
      SOAP_INVENTORY_PASSWORD,
      SOAP_INVENTORY_SOAPACTION,
      SOAP_INVENTORY_XMLNS,
    } = org;

    if (
      !SOAP_INVENTORY_URL ||
      !SOAP_INVENTORY_USERNAME ||
      !SOAP_INVENTORY_PASSWORD ||
      !SOAP_INVENTORY_SOAPACTION ||
      !SOAP_INVENTORY_XMLNS
    ) {
      console.log("Konfigurasi soap inventory tidak lengkap");
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: checkInventoryXML(No, locationCode), // <-- XML generator khusus produk
      username: SOAP_INVENTORY_USERNAME,
      password: SOAP_INVENTORY_PASSWORD,
      url: SOAP_INVENTORY_URL,
      SOAPAction: SOAP_INVENTORY_SOAPACTION,
    });
    console.log(rawXmlResponse);
    if (!rawXmlResponse) {
      console.log("Response kosong");
      return null;
    }

    const parsed = await xml2js.parseStringPromise(rawXmlResponse, {
      explicitArray: false,
      trim: true,
    });

    const body = parsed?.["Soap:Envelope"]?.["Soap:Body"];

    if (!body) {
      console.log("Tidak bisa menemukan data hasil");
      return null;
    }

    const inventoryValue = body?.GetInventoryByLocation_Result?.inventory;

    return inventoryValue !== undefined ? Number(inventoryValue) : null;
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

const PRODUCT_SOURCE_FIELDS = [
  "URL",
  "USERNAME",
  "PASSWORD",
  "SOAPACTION",
  "XMLNS",
];

const productSourcePrefix = (organization) =>
  organization === "ril" ? "SOAP_PRODUCT_RIL_" : "SOAP_PRODUCT_";

export const readProductSource = (org, organization) => {
  const prefix = productSourcePrefix(organization);
  const source = {
    organization,
    url: org?.[`${prefix}URL`],
    username: org?.[`${prefix}USERNAME`],
    password: org?.[`${prefix}PASSWORD`],
    soapAction: org?.[`${prefix}SOAPACTION`],
    xmlns: org?.[`${prefix}XMLNS`],
  };
  const missing = PRODUCT_SOURCE_FIELDS.filter(
    (field) => !String(org?.[`${prefix}${field}`] ?? "").trim(),
  );
  return { source, missing };
};

const ENV_PRODUCT_SEED_FIELDS = [
  "SOAP_PRODUCT_URL",
  "SOAP_PRODUCT_USERNAME",
  "SOAP_PRODUCT_PASSWORD",
  "SOAP_PRODUCT_SOAPACTION",
  "SOAP_PRODUCT_XMLNS",
  "SOAP_PRODUCT_RIL_URL",
  "SOAP_PRODUCT_RIL_USERNAME",
  "SOAP_PRODUCT_RIL_PASSWORD",
  "SOAP_PRODUCT_RIL_SOAPACTION",
  "SOAP_PRODUCT_RIL_XMLNS",
];

const isBlank = (value) =>
  value === undefined || value === null || String(value).trim() === "";

export const findProductOrg = () =>
  Org.findOne({
    SOAP_PRODUCT_URL: { $exists: true, $nin: [null, ""] },
  }).then((org) => org || Org.findOne());

/** Env fills empty Org SOAP product fields only. Values already in the database stay. */
export const seedProductSourcesFromEnv = async () => {
  await connectDB();

  const org = await findProductOrg();
  if (!org) {
    console.log("Tidak ada organisasi untuk seed SOAP product");
    return null;
  }

  const $set = {};
  for (const field of ENV_PRODUCT_SEED_FIELDS) {
    const envValue = process.env[field];
    if (!isBlank(envValue) && isBlank(org[field])) {
      $set[field] = envValue.trim();
    }
  }

  if (isBlank(org.SOAP_PRODUCT_RIL_XMLNS) && isBlank($set.SOAP_PRODUCT_RIL_XMLNS)) {
    const csiXmlns = $set.SOAP_PRODUCT_XMLNS || org.SOAP_PRODUCT_XMLNS;
    if (!isBlank(csiXmlns)) {
      $set.SOAP_PRODUCT_RIL_XMLNS = String(csiXmlns).trim();
    }
  }

  if (Object.keys($set).length > 0) {
    await Org.updateOne({ _id: org._id }, { $set });
    console.log(
      `Seed SOAP product ke org ${org.organizationName}: ${Object.keys($set).join(", ")}`,
    );
  }

  return org._id;
};

export const ensureProductOrganizationIndex = async () => {
  await Product.updateMany(
    {
      $or: [{ organization: { $exists: false } }, { organization: null }],
    },
    { $set: { organization: "csi" } },
  );

  try {
    const indexes = await Product.collection.indexes();
    const legacyUnique = indexes.find(
      (index) => index.unique && index.key?.No === 1 && !index.key?.organization,
    );
    if (legacyUnique?.name) {
      await Product.collection.dropIndex(legacyUnique.name);
    }
  } catch (error) {
    console.log("Index produk lama tidak diubah:", error.message);
  }

  await Product.syncIndexes();
};

export const fetchingSoap = async (source) => {
  try {
    if (
      !source?.url ||
      !source?.username ||
      !source?.password ||
      !source?.soapAction ||
      !source?.xmlns
    ) {
      console.log(
        `Konfigurasi soap product ${source?.organization || ""} tidak lengkap`,
      );
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: productXml({ SOAP_PRODUCT_XMLNS: source.xmlns }),
      username: source.username,
      password: source.password,
      url: source.url,
      SOAPAction: source.soapAction,
    });

    if (!rawXmlResponse) {
      console.log("Response kosong");
      return null;
    }

    const parsed = await xml2js.parseStringPromise(rawXmlResponse, {
      explicitArray: false,
      trim: true,
    });

    const result =
      parsed?.["Soap:Envelope"]?.["Soap:Body"]?.["ReadMultiple_Result"]?.[
        "ReadMultiple_Result"
      ];

    if (!result) {
      console.log("Tidak bisa menemukan data hasil");
      return null;
    }

    // Ambil data produk dari key <midapi>
    let products = result.midapi;

    if (!products) {
      console.log("Tidak ada produk di dalam midapi");
      return null;
    }

    // Jika hanya 1 item, bungkus jadi array
    if (!Array.isArray(products)) {
      products = [products];
    }

    return products;
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

export const fieldsToSanitize = [
  "Net_Weight",
  "Web",
  "recgrosir",
  "_x003C_recretail_x003E_",
  "Unit_Volume", // <- kalau mau tetap String, hapus dari sini
  "OS_Price",
  "MP_Price",
  "JD_Price",
  "TEMP",
  "Retail",
];

const syncProductsForSource = async (productJSON, organization) => {
  if (!productJSON || productJSON.length === 0) {
    console.log(`Tidak ada data product ${organization} untuk diperbarui`);
    return;
  }

  const existingProduct = await Product.find(
    {
      organization,
      No: { $in: productJSON.map((c) => c?.No).filter(Boolean) },
    },
    { No: 1, hash: 1 },
  ).lean();

  const existingMap = new Map();
  for (const c of existingProduct) {
    existingMap.set(c.No, c.hash);
  }

  const bulkOps = [];

  for (const rawProduct of productJSON) {
    if (!rawProduct || !rawProduct.No) continue;

    const product = { ...rawProduct };
    delete product.organization;

    const no = product.No;
    const newHash = hashProductData(product);
    const existingHash = existingMap.get(no);

    if (existingHash !== newHash) {
      for (const field of fieldsToSanitize) {
        if (product[field] !== undefined && product[field] !== null) {
          const parsed = parseFloat(product[field]);
          product[field] = isNaN(parsed) ? 0 : Math.floor(parsed);
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { No: no, organization },
          update: {
            $set: {
              ...product,
              organization,
              hash: newHash,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
    console.log(
      `Update ${organization} selesai. Jumlah data berubah: ${bulkOps.length}`,
    );
  } else {
    console.log(`Tidak ada data ${organization} yang berubah.`);
  }
};

export const reinitilizeProductFromSoap = async () => {
  await connectDB();

  try {
    await seedProductSourcesFromEnv();
    await ensureProductOrganizationIndex();

    const org = await findProductOrg();
    if (!org) {
      console.log("Organisasi untuk SOAP product tidak ditemukan");
      return null;
    }

    const orgConfig = org.toObject();

    for (const organization of PRODUCT_ORGANIZATIONS) {
      const { source, missing } = readProductSource(orgConfig, organization);
      if (missing.length > 0) {
        console.log(
          `Konfigurasi soap product ${organization} tidak lengkap: ${missing.join(", ")}`,
        );
        continue;
      }

      const productJSON = await fetchingSoap(source);
      await syncProductsForSource(productJSON, organization);
    }
  } catch (error) {
    console.error("Gagal reinit product:", error);
    return null;
  }
};

let cronProductStarted = false;
export let productSetupPromise = Promise.resolve();

function startCronProduct() {
  if (cronProductStarted) return;
  cronProductStarted = true;

  productSetupPromise = seedProductSourcesFromEnv()
    .then(() => ensureProductOrganizationIndex())
    .then(() => ({ ok: true }))
    .catch((error) => {
      console.log("Seed SOAP product gagal:", error);
      return { ok: false, error };
    });

  reinitilizeProductFromSoap();
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("🔃reinitilize Product From soap..");
      await reinitilizeProductFromSoap();
      console.log("✅reinitilize product From source");
    } catch (error) {
      console.log(error);
    }
  });
}
startCronProduct();

export default startCronProduct;