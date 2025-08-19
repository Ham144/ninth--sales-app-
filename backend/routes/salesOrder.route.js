import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import { requestSalesOrderXml } from "../xml.js";
import xml2js from "xml2js";
import generateGlobalIndex from "../utils/generateGlobalIndex.js";
import { getCurrentDateForNAV } from "../utils/getCurrentDateTanggalBlnThn.js";
import GetMyOrganizationAbbr from "../utils/getMyOrganizationAbbr.js";
import SalesOrder from "../models/SalesOrder.model.js";
import Org from "../models/Organization.model.js";
import Customer from "../models/Customer.model.js";
import Product from "../models/product.model.js";
import TemporarySalesOrder from "../models/temporarySalesOrder.model.js";
import mongoose from "mongoose";
import { Mongoose } from "mongoose";

const router = Router();

export const requestSalesOrder = async ({
  DocumentNo,
  SellToCustNo,
  ExtDoc,
  RequestDeliveryDate,
  Keterangan,
  SalesLine,
  req,
}) => {
  try {
    const org = await Org.findById(req.user.org).select(
      "SOAP_TRANSACTION_URL SOAP_TRANSACTION_USERNAME SOAP_TRANSACTION_PASSWORD SOAP_TRANSACTION_SOAPACTION"
    );

    const {
      SOAP_TRANSACTION_URL,
      SOAP_TRANSACTION_USERNAME,
      SOAP_TRANSACTION_PASSWORD,
      SOAP_TRANSACTION_SOAPACTION,
    } = org;

    if (
      !SOAP_TRANSACTION_URL ||
      !SOAP_TRANSACTION_USERNAME ||
      !SOAP_TRANSACTION_PASSWORD ||
      !SOAP_TRANSACTION_SOAPACTION
    ) {
      console.log("konfigurasi SOAP Transaction tidak lengkap");
      return null;
    }

    const xml = requestSalesOrderXml({
      DocumentNo,
      SellToCustNo,
      ExtDoc,
      RequestDeliveryDate,
      SalesLine,
      Keterangan,
    });

    const rawXmlResponse = await fetchData({
      xml: xml,
      username: SOAP_TRANSACTION_USERNAME,
      password: SOAP_TRANSACTION_PASSWORD,
      url: SOAP_TRANSACTION_URL,
      SOAPAction: SOAP_TRANSACTION_SOAPACTION,
    });

    if (!rawXmlResponse) {
      console.log("Response kosong");
      return { error: true, message: "Response kosong" };
    }

    let parsed;
    try {
      parsed = await xml2js.parseStringPromise(rawXmlResponse, {
        explicitArray: false,
        trim: true,
        tagNameProcessors: [xml2js.processors.stripPrefix],
      });
    } catch (err) {
      console.error("Gagal parse XML:", err);
      return { error: true, message: "Gagal parse XML" };
    }

    // 🔹 Cek kalau respons berisi error SOAP
    const fault = parsed?.Envelope?.Body?.Fault;
    if (fault) {
      return {
        error: true,
        code: fault?.faultcode || null,
        message: fault?.faultstring || "SOAP Fault tanpa pesan",
      };
    }

    // 🔹 Ambil node utama secara dinamis
    const body = parsed?.Envelope?.Body;
    const key = body
      ? Object.keys(body).find((k) => k.includes("SalesMobileInsert"))
      : null;
    const result = key ? body[key] : null;

    if (!result) {
      console.log("Tidak bisa mendapatkan response transaction");
      return {
        error: true,
        message: "Tidak bisa mendapatkan response transaction",
      };
    }

    // 🔹 Normalisasi response
    return {
      error: false,
      return_value: result?.return_value || null,
      salesHeader: result?.xML_Sales?.SalesHeader || null,
    };
  } catch (error) {
    console.log("Terjadi error:", error);
    return null;
  }
};

router.post("/new", async (req, res) => {
  const { customer, products } = req.body;

  try {
    const globalIndex = await generateGlobalIndex(req, "globalIndex");

    if (!globalIndex)
      return res.status(500).json({ message: "Gagal membuat global index" });

    let SalesLine = [];
    for (let i = 0; i < products.length; i++) {
      SalesLine.push({
        DocumentNo: globalIndex,
        LineNo: (i + 1) * 1000,
        ItemNo: products[i].No || "",
        Qty: products[i].qty,
        UnitPrice: products[i].price * products[i].qty,
        LineDiscountAmount: "",
        PromoCode: "",
      });
    }

    const orderDate = new Date().toISOString().split("T")[0];
    const salesOrderResponseXml = await requestSalesOrder({
      DocumentNo: globalIndex,
      ExtDoc: globalIndex,
      SellToCustNo: customer.No,
      RequestDeliveryDate: getCurrentDateForNAV(),
      Keterangan: req.user.username,
      SalesLine,
      req,
    });

    if (salesOrderResponseXml?.error || !salesOrderResponseXml) {
      console.log("Request Sales Order Gagal: ", salesOrderResponseXml);
      return res.status(500).json({
        message: JSON.stringify(
          salesOrderResponseXml?.message || salesOrderResponseXml
        ),
      });
    }

    const SalesLineTotal = SalesLine.reduce((total, item) => {
      return total + item.UnitPrice;
    }, 0);

    const generatedSalesOrder = await SalesOrder.create({
      return_value: salesOrderResponseXml.return_value,
      DocumentNo: globalIndex,
      customer: customer._id,
      ShiptToCode: customer.ShiptToCode || "",
      OrderDate: orderDate,
      LocationCode: customer.Location_Code || "",
      Dim1: customer.Dim1 || "",
      CustomerPriceGrp: customer.Customer_Price_Group,
      SalespersonCode: customer.Salesperson_Code || "",
      NoSeries: await GetMyOrganizationAbbr({ req }),
      ExtDoc: req.user.username, //nama si user
      RequestDeliveryDate: new Date(
        convertToISOConvertableDate(getCurrentDateForNAV())
      ),
      SalesLine: SalesLine,
      SalesLineTotal: SalesLineTotal,
      org: req.user.org,
      createdBy: req.user._id,
    });

    return res.status(200).json(generatedSalesOrder);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

router.get("/list", async (req, res) => {
  const { searchKey } = req.query;

  try {
    let matchStage = { org: req.user.org, createdBy: req.user._id };

    if (searchKey && searchKey !== "undefined") {
      matchStage = {
        $and: [
          { org: req.user.org },
          {
            $or: [
              { DocumentNo: { $regex: searchKey, $options: "i" } },
              { SalespersonCode: { $regex: searchKey, $options: "i" } },
              { ExtDoc: { $regex: searchKey, $options: "i" } },
              { SellToCustNo: { $regex: searchKey, $options: "i" } },
              { return_value: { $regex: searchKey, $options: "i" } },
              { "customer.Name": { $regex: searchKey, $options: "i" } },
            ],
          },
        ],
      };
    }

    const salesOrders = await SalesOrder.find(matchStage)
      .populate("customer", "Name No")
      .select(
        "_id return_value DocumentNo RequestDeliveryDate customer SalesLineTotal"
      )
      .lean();

    return res.status(200).json(salesOrders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

router.get("/getById/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const salesOrder = await SalesOrder.findById(id).lean();
    return res.status(200).json(salesOrder);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

//terima productsNo
router.put("/temp/create", async (req, res) => {
  const { products, customerId, frontendSession, comment } = req.body;

  try {
    const existingTemporarySalesOrder = await TemporarySalesOrder.findOne({
      createdBy: req.user._id,
      org: req.user.org,
      frontendSession,
    });

    if (existingTemporarySalesOrder) {
      if (comment) {
        existingTemporarySalesOrder.comment = comment;
      }
      if (products) {
        console.log("updating products");
        existingTemporarySalesOrder.products = products;
        await existingTemporarySalesOrder.save();
        return res.json({
          success: true,
          message: "Temporary Sales Order Berhasil diperbarui",
          data: existingTemporarySalesOrder,
        });
      }
    } else {
      const customerDB = await Customer.findById(customerId);

      if (!customerDB) {
        return res.status(404).json({ message: "Customer Tidak Ditemukan" });
      }

      const currentDate = new Date();
      const hour = currentDate.getHours();
      const day = currentDate.getDate();
      const month = currentDate.getMonth() + 1; // bulan dari 0
      const year = currentDate.getFullYear();
      const defaultComment = `${hour}-${day}-${month}-${year}-${customerDB.Name}`;

      const newTemp = await TemporarySalesOrder.create({
        customer: customerDB._id,
        comment: comment ?? defaultComment,
        org: req.user.org,
        products,
        frontendSession,
        createdBy: req.user._id,
      });

      return res.json({
        success: true,
        message: "Temporary Sales Order Berhasil Dibuat",
        data: newTemp,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

router.get("/temp/collect", async (req, res) => {
  const { customerId } = req.query;

  try {
    const tempSO = await TemporarySalesOrder.find({
      customer: new mongoose.Types.ObjectId(customerId),
    });

    if (!tempSO) {
      return res
        .status(204)
        .json({ message: "Temporary Sales Order Tidak Ditemukan" });
    }

    return res.status(200).json({
      data: tempSO,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

export default router;

export const convertToISOConvertableDate = (dateStr) => {
  // dari DD/MM/YYYY → YYYY-MM-DD
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
};
