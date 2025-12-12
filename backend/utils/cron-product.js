import { connectDB } from "./connectDB.js";
import "dotenv/config";
import cron from "node-cron";
import { checkStockXML, productXml } from "../xml.js";
import { fetchData } from "./soap-util.js";
import "dotenv/config";
import xml2js from "xml2js";
import crypto from "crypto";
import Product from "../models/product.model.js";
import Org from "../models/Organization.model.js";

function hashProductData(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const fetchingSoapToGetStock = async (No, locationCode, req) => {
  try {
    const org = await Org.findOne().select(
      "SOAP_STOCK_URL SOAP_STOCK_USERNAME SOAP_STOCK_PASSWORD SOAP_STOCK_SOAPACTION SOAP_STOCK_XMLNS"
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

export const fetchingSoap = async () => {
  try {
    const org = await Org.findOne()
      .select(
        "SOAP_PRODUCT_URL SOAP_PRODUCT_USERNAME SOAP_PRODUCT_PASSWORD SOAP_PRODUCT_SOAPACTION SOAP_PRODUCT_XMLNS"
      )
      .lean();

    if (!org) {
      return null;
    }

    const {
      SOAP_PRODUCT_URL,
      SOAP_PRODUCT_USERNAME,
      SOAP_PRODUCT_PASSWORD,
      SOAP_PRODUCT_SOAPACTION,
      SOAP_PRODUCT_XMLNS,
    } = org;

    if (
      !SOAP_PRODUCT_URL ||
      !SOAP_PRODUCT_USERNAME ||
      !SOAP_PRODUCT_PASSWORD ||
      !SOAP_PRODUCT_SOAPACTION ||
      !SOAP_PRODUCT_XMLNS
    ) {
      console.log("Konfigurasi soap product tidak lengkap");
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: productXml({ SOAP_PRODUCT_XMLNS }), // <-- XML generator khusus produk
      username: SOAP_PRODUCT_USERNAME,
      password: SOAP_PRODUCT_PASSWORD,
      url: SOAP_PRODUCT_URL,
      SOAPAction: SOAP_PRODUCT_SOAPACTION,
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

const reinitilizeProductFromSoap = async () => {
  await connectDB();

  try {
    const productJSON = await fetchingSoap();
    if (!productJSON || productJSON.length === 0) {
      console.log("Tidak ada data product untuk diperbarui");
      return null;
    }

    // Step 1: Ambil existing hash dari DB berdasarkan No
    const existingProduct = await Product.find(
      { No: { $in: productJSON.map((c) => c?.No) } },
      { No: 1, hash: 1 }
    ).lean();

    const existingMap = new Map();
    for (let c of existingProduct) {
      existingMap.set(c.No, c.hash);
    }

    // Step 2: Susun bulkOps berdasarkan hash comparison
    const bulkOps = [];

    for (let product of productJSON) {
      if (!product || !product.No) continue;

      const no = product.No;
      const newHash = hashProductData(product);
      const existingHash = existingMap.get(no);

      if (existingHash !== newHash) {
        // 👇 Sanitize fields
        for (let field of fieldsToSanitize) {
          if (product[field] !== undefined && product[field] !== null) {
            const parsed = parseFloat(product[field]);
            product[field] = isNaN(parsed) ? 0 : Math.floor(parsed);
          }
        }

        bulkOps.push({
          updateOne: {
            filter: { No: no },
            update: {
              $set: {
                ...product,
                hash: newHash,
              },
            },
            upsert: true,
          },
        });
      }
    }

    // Step 3: Eksekusi bulkWrite
    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`Update selesai. Jumlah data berubah: ${bulkOps.length}`);
    } else {
      console.log("Tidak ada data yang berubah.");
    }
  } catch (error) {
    console.error("Gagal reinit customer:", error);
    return null;
  }
};

function startCronProduct() {
  if (process.env.NODE_ENV == "development") {
    console.log("Skip cron product in development env");
    return;
  }
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
