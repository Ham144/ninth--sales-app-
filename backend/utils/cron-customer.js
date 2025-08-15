import { connectDB } from "./connectDB.js";
import "dotenv/config";
import cron from "node-cron";
import Customer from "../models/Customer.model.js";
import { customerXml } from "../xml.js";
import { fetchData } from "./soap-util.js";
import "dotenv/config";
import xml2js from "xml2js";
import crypto from "crypto";
import Org from "../models/Organization.model.js";

function hashCustomerData(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const fetchingSoap = async () => {
  try {
    const org = await Org.findById(req.user.org).select(
      "SOAP_CUSTOMER_URL SOAP_CUSTOMER_USERNAME SOAP_CUSTOMER_PASSWORD SOAP_CUSTOMER_SOAPACTION"
    );
    const {
      SOAP_CUSTOMER_URL,
      SOAP_CUSTOMER_USERNAME,
      SOAP_CUSTOMER_PASSWORD,
      SOAP_CUSTOMER_SOAPACTION,
    } = org;

    if (
      !SOAP_CUSTOMER_URL ||
      !SOAP_CUSTOMER_USERNAME ||
      !SOAP_CUSTOMER_PASSWORD ||
      !SOAP_CUSTOMER_SOAPACTION
    ) {
      console.log("konfigurasi soap customer tidak lengkap");
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: customerXml(),
      username: SOAP_CUSTOMER_USERNAME,
      password: SOAP_CUSTOMER_PASSWORD,
      url: SOAP_CUSTOMER_URL,
      SOAPAction: SOAP_CUSTOMER_SOAPACTION,
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

    // Bisa jadi 1 object atau array tergantung jumlah data
    const customers = Array.isArray(result["API_Cust_APP"])
      ? result["API_Cust_APP"]
      : [result["API_Cust_APP"]];

    return customers;
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

const reinitilizeCustomerFromSoap = async () => {
  await connectDB();

  try {
    const customersJSON = await fetchingSoap();

    if (!customersJSON || customersJSON.length === 0) {
      console.log("Tidak ada data customer untuk diperbarui");
      return null;
    }

    // Step 1: Ambil existing hash dari DB berdasarkan No
    const existingCustomers = await Customer.find(
      { No: { $in: customersJSON.map((c) => c.No) } },
      { No: 1, hash: 1 }
    ).lean();

    const existingMap = new Map();
    for (let c of existingCustomers) {
      existingMap.set(c.No, c.hash);
    }

    // Step 2: Susun bulkOps berdasarkan hash comparison
    const bulkOps = [];

    for (let customer of customersJSON) {
      const no = customer.No;
      const newHash = hashCustomerData(customer);
      const existingHash = existingMap.get(no);

      if (existingHash !== newHash) {
        bulkOps.push({
          updateOne: {
            filter: { No: no },
            update: {
              $set: {
                ...customer,
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
      await Customer.bulkWrite(bulkOps);
      console.log(`Update selesai. Jumlah data berubah: ${bulkOps.length}`);
    } else {
      console.log("Tidak ada data yang berubah.");
    }
  } catch (error) {
    console.error("Gagal reinit customer:", error);
    return null;
  }
};

function startCronCustomer() {
  if (process.env.NODE_ENV === "development") {
    console.log("Skip cron customer in development env");
    return;
  }
  reinitilizeCustomerFromSoap();
  cron.schedule("0 1 * * *", async () => {
    try {
      console.log("🔃reinitilize Customer From soap..");
      await reinitilizeCustomerFromSoap();
      console.log("✅reinitilize Customer From from SOAP");
    } catch (error) {
      console.log(error);
    }
  });
}

export default startCronCustomer;
