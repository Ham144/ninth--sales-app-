import { Router } from "express";
import escapeRegex from "../utils/excapeRegexInject.js";
import Customer from "../models/Customer.model.js";
import { cekPembayaranTertundaXml } from "../xml.js";
import { parseStringPromise } from "xml2js";
import { fetchData } from "../utils/soap-util.js";
import Org from "../models/Organization.model.js";

const router = Router();

//ini untuk search hanya mengambil sangat sedikit field
router.get("/list", async (req, res) => {
  const searchKey = req.query.searchKey || "";
  const skip = parseInt(req.query.skip) || 0;
  const limit = parseInt(req.query.limit) || 10;

  let query = {};
  if (searchKey) {
    const escaped = escapeRegex(searchKey);
    query = {
      $or: [
        { No: { $regex: "^" + escaped, $options: "i" } },
        { Name: { $regex: "^" + escaped, $options: "i" } },
        { Phone_No: { $regex: "^" + escaped, $options: "i" } },
        { HP_No: { $regex: "^" + escaped, $options: "i" } },
      ],
    };
  }

  try {
    const total = await Customer.countDocuments(query);
    const data = await Customer.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // opsional: urutkan
      .select("_id No Name")
      .lean();

    const totalPages = Math.ceil(total / limit);

    return res.json({
      data,
      total,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      message: "berhasil ambil data",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

//ini untuk getByNo lebih detail serta mengecek pembayaran tertunda
router.post("/getByNo/:no", async (req, res) => {
  const no = req.params.no;

  try {
    let customer = await Customer.findOne({ No: no });
    if (!customer) {
      return res.status(404).json({
        message: "Data customer tidak ditemukan",
      });
    }

    const myOrganization = await Org.findById(req.user.org).select(
      "SOAP_PEMBAYARANTERTUNDA_USERNAME SOAP_PEMBAYARANTERTUNDA_PASSWORD SOAP_PEMBAYARANTERTUNDA_SOAPACTION SOAP_PEMBAYARANTERTUNDA_URL SOAP_PEMBAYARANTERTUNDA_XMLNS"
    );

    //cek pembayaran tertunda
    const xml = cekPembayaranTertundaXml({
      customerNo: customer?.No,
      SOAP_PEMBAYARANTERTUNDA_XMLNS:
        myOrganization.SOAP_PEMBAYARANTERTUNDA_XMLNS,
    });
    const username = myOrganization.SOAP_PEMBAYARANTERTUNDA_USERNAME;
    const password = myOrganization.SOAP_PEMBAYARANTERTUNDA_PASSWORD;
    const soap_action = myOrganization.SOAP_PEMBAYARANTERTUNDA_SOAPACTION;
    const url = myOrganization.SOAP_PEMBAYARANTERTUNDA_URL;

    const pembayaranTertundaXmlResponse = await fetchData({
      xml,
      username,
      password,
      url,
      SOAPAction: soap_action,
    });

    // Ubah XML ke JSON
    const pembayaranTertundaJson = await parseStringPromise(
      pembayaranTertundaXmlResponse,
      {
        explicitArray: false,
        ignoreAttrs: false,
      }
    );

    // Akses data RemainingSI (array isi tag RemainingSI)
    const remainingSIList =
      pembayaranTertundaJson["Soap:Envelope"]?.["Soap:Body"]?.[
        "ReadMultiple_Result"
      ]?.["ReadMultiple_Result"]?.["RemainingSI"];

    const today = new Date().toISOString().slice(0, 10);

    // filter yang due date-nya di bawah hari ini
    const pembayaranTertunda =
      remainingSIList?.length > 1
        ? remainingSIList?.filter((item) => {
            const dueDate = new Date(item["Due_Date"]).getTime();
            return dueDate < new Date(today).getTime();
          })
        : remainingSIList;

    const data = {
      customer,
      pembayaranTertunda,
    };

    return res.json({
      data,
      message: "berhasil mengambil single data",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

//ini untuk detail juga mengembalikan array customer
router.get("/list/detail", async (req, res) => {
  const searchKey = req.query.searchKey || "";
  const skip = parseInt(req.query.skip) || 0;
  const limit = parseInt(req.query.limit) || 10;

  let query = {};
  if (searchKey) {
    const escaped = escapeRegex(searchKey);
    query = {
      $or: [
        { No: { $regex: "^" + escaped, $options: "i" } },
        { Name: { $regex: "^" + escaped, $options: "i" } },
        { Phone_No: { $regex: "^" + escaped, $options: "i" } },
        { HP_No: { $regex: "^" + escaped, $options: "i" } },
      ],
    };
  }

  try {
    const total = await Customer.countDocuments(query);
    const data = await Customer.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // opsional: urutkan
      .lean();

    const totalPages = Math.ceil(total / limit);

    return res.json({
      data,
      total,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      message: "berhasil ambil data",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

export default router;
