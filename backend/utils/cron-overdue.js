import { connectDB } from "./connectDB.js";
import "dotenv/config";
import cron from "node-cron";
import { pembayaranTertundaFullXml } from "../xml.js";
import { fetchData } from "./soap-util.js";
import "dotenv/config";
import xml2js from "xml2js";
import Org from "../models/Organization.model.js";
import Overdue from "../models/OverDue.model.js";

export const fetchingSoap = async () => {
  try {
    const org = await Org.find().select(
      "SOAP_PEMBAYARANTERTUNDA_URL SOAP_PEMBAYARANTERTUNDA_USERNAME SOAP_PEMBAYARANTERTUNDA_PASSWORD SOAP_PEMBAYARANTERTUNDA_SOAPACTION"
    );

    const {
      SOAP_PEMBAYARANTERTUNDA_URL,
      SOAP_PEMBAYARANTERTUNDA_USERNAME,
      SOAP_PEMBAYARANTERTUNDA_PASSWORD,
      SOAP_PEMBAYARANTERTUNDA_SOAPACTION,
    } = org[0];

    if (
      !SOAP_PEMBAYARANTERTUNDA_URL ||
      !SOAP_PEMBAYARANTERTUNDA_PASSWORD ||
      !SOAP_PEMBAYARANTERTUNDA_SOAPACTION ||
      !SOAP_PEMBAYARANTERTUNDA_USERNAME
    ) {
      console.log("konfigurasi soap overdue/pembayaran tertunda tidak lengkap");
      return null;
    }

    const rawXmlResponse = await fetchData({
      xml: pembayaranTertundaFullXml(),
      username: SOAP_PEMBAYARANTERTUNDA_USERNAME,
      password: SOAP_PEMBAYARANTERTUNDA_PASSWORD,
      url: SOAP_PEMBAYARANTERTUNDA_URL,
      SOAPAction: SOAP_PEMBAYARANTERTUNDA_SOAPACTION,
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

    if (!result || !result["RemainingSI"]) {
      console.log("Tidak bisa menemukan data hasil");
      return null;
    }

    const overdues = Array.isArray(result["RemainingSI"])
      ? result["RemainingSI"]
      : [result["RemainingSI"]];

    return overdues;
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

export const reinitilizingOverdueList = async () => {
  await connectDB();

  try {
    const overdueJSON = await fetchingSoap();

    if (!overdueJSON || overdueJSON.length === 0) {
      console.log("Tidak ada data customer untuk diperbarui");
      return null;
    }

    // Mapping data SOAP → schema mongoose
    const mappedOverdues = overdueJSON.map((item) => ({
      customerNo: Number(item.Customer_No),
      postingDate: new Date(item.Posting_Date),
      dueDate: new Date(item.Due_Date),
      documentNo: item.Document_No,
      salespersonCode: item.Salesperson_Code,
      remainingAmount: Number(item.Remaining_Amount),
    }));

    // Hapus semua data lama lalu insert yang baru
    await Overdue.deleteMany({});
    const insertedOverdues = await Overdue.insertMany(mappedOverdues);

    console.log(`Berhasil insert ${insertedOverdues.length} data overdue`);
    return insertedOverdues;
  } catch (error) {
    console.error("Gagal reinit customer:", error);
    return null;
  }
};

function startCronOverdue() {
  if (process.env.NODE_ENV === "development") {
    console.log("Skip cron overdue in development env");
    return;
  }
  reinitilizingOverdueList();
  cron.schedule("0 4 * * *", async () => {
    try {
      console.log("🔃Delete and download overdue From soap..");
      await reinitilizingOverdueList();
      console.log("✅Delete and download overdue From soap");
    } catch (error) {
      console.log(error);
    }
  });
}

export default startCronOverdue;
