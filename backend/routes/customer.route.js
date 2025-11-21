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

  const userInfo = req.user;
  const vendor =
    userInfo?.description?.startsWith("SALES") &&
    userInfo?.description?.split("_")[1];

  let query = {};
  if (vendor) {
    query = {
      $and: [
        { Brand: { $regex: vendor, $options: "i" } }, // cocok dengan vendor
        { Brand: { $nin: ["", null] } }, // tidak kosong/null
        { Brand: { $exists: true } }, // field harus ada
      ],
    };
  }
  if (searchKey) {
    const escaped = escapeRegex(searchKey?.trim());
    query = {
      $or: [
        { No: { $regex: escaped, $options: "i" } },
        { Name: { $regex: escaped, $options: "i" } },
        { Phone_No: { $regex: escaped, $options: "i" } },
        { HP_No: { $regex: escaped, $options: "i" } },
      ],
    };
  }

  try {
    const total = await Customer.countDocuments(query);
    const data = await Customer.find(query)
      .skip(skip)
      .limit(!searchKey ? 10 : limit)
      .sort({ createdAt: -1 }) // opsional: urutkan
      .select("_id No Name Address")
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
router.get("/getByNo/:no", async (req, res) => {
  const no = req.params.no;

  try {
    let customer = await Customer.findOne({ No: no });
    if (!customer) {
      return res.status(404).json({
        message: "Data customer tidak ditemukan",
      });
    }

    const vendor = req?.user?.description?.split("_")[1];

    let pembayaranTertunda = [];
    //jika ada vendor tidak perlu keluarin overdue
    if (!vendor) {
      console.log("vendor tidak ada jadi masuk sini ");
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
      pembayaranTertunda =
        remainingSIList?.length > 1
          ? remainingSIList?.filter((item) => {
              const dueDate = new Date(item["Due_Date"]).getTime();
              return dueDate < new Date(today).getTime();
            })
          : [];

      const data = {
        customer,
        pembayaranTertunda,
      };
      return res.json({
        data: data,
        message: "berhasil mengambil single data",
      });
    }

    //sensor beberapa value jika SMD
    const customerObj = customer.toObject();
    customer = {
      ...customerObj,
      Balance: "SMD not GRANTED",
      Balance_Due: "SMD not GRANTED",
      Credit_Limit_LCY: "SMD not GRANTED",
    };
    const data = {
      customer,
    };

    return res.json({
      data: data,
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
