import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import { requestSalesOrderXml } from "../xml.js";
import xml2js from "xml2js";
import generateGlobalIndex from "../utils/generateGlobalIndex.js";
import { getCurrentDateForNAV } from "../utils/getCurrentDateTanggalBlnThn.js";
import GetMyOrganizationAbbr from "../utils/getMyOrganizationAbbr.js";
import SalesOrder from "../models/SalesOrder.model.js";
import { parse } from "dotenv";

const router = Router();

export const requestSalesOrder = async ({
  DocumentNo,
  SellToCustNo,
  ShiptToCode,
  OrderDate,
  LocationCode,
  CustomerPriceGrp,
  SalespersonCode,
  NoSeries,
  ExtDoc,
  RequestDeliveryDate,
  SalesLine,
}) => {
  if (!DocumentNo) return console.log("DocumentNo not found");
  if (!SellToCustNo) return console.log("SellToCustNo not found");
  if (!CustomerPriceGrp) return console.log("CustomerPriceGrp not found");
  if (!NoSeries) return console.log("NoSeries not found");
  if (!RequestDeliveryDate) return console.log("RequestDeliveryDate not found");
  if (!SalesLine) return console.log("SalesLine not found");

  try {
    const {
      SOAP_TRANSACTION_URL,
      SOAP_TRANSACTION_USERNAME,
      SOAP_TRANSACTION_PASSWORD,
      SOAP_TRANSACTION_SOAPACTION,
    } = process.env;

    if (
      !SOAP_TRANSACTION_URL ||
      !SOAP_TRANSACTION_USERNAME ||
      !SOAP_TRANSACTION_PASSWORD ||
      !SOAP_TRANSACTION_SOAPACTION
    ) {
      console.log("Tidak ada konfigurasi API Source");
      return null;
    }

    const xml = requestSalesOrderXml({
      DocumentNo,
      SellToCustNo,
      ShiptToCode,
      OrderDate,
      LocationCode,
      CustomerPriceGrp,
      SalespersonCode,
      NoSeries,
      ExtDoc,
      RequestDeliveryDate,
      SalesLine,
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

    // 🔹 Kalau sukses
    const result = parsed?.Envelope?.Body?.SalesMobileInsert_Result;
    if (!result) {
      console.log("Tidak bisa mendapatkan response transaction");
      return {
        error: true,
        message: "Tidak bisa mendapatkan response transaction",
      };
    }

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
      SellToCustNo: customer.No,
      ShiptToCode: customer.ShiptToCode || "",
      OrderDate: orderDate,
      LocationCode: customer.Location_Code || "",
      CustomerPriceGrp: customer.Customer_Price_Group,
      SalespersonCode: customer.Salesperson_Code || "",
      NoSeries: "SO-" + (await GetMyOrganizationAbbr({ req })),
      ExtDoc: globalIndex,
      RequestDeliveryDate: getCurrentDateForNAV(),
      SalesLine: SalesLine,
    });

    if (salesOrderResponseXml?.error) {
      return res
        .status(500)
        .json({ message: JSON.stringify(salesOrderResponseXml.message) });
    }

    const generatedSalesOrder = await SalesOrder.create({
      return_value: salesOrderResponseXml.return_value,
      DocumentNo: globalIndex,
      SellToCustNo: customer.No,
      ShiptToCode: customer.ShiptToCode || "",
      OrderDate: orderDate,
      LocationCode: customer.Location_Code || "",
      Dim1: customer.Dim1 || "",
      CustomerPriceGrp: customer.Customer_Price_Group,
      SalespersonCode: customer.Salesperson_Code || "",
      NoSeries: await GetMyOrganizationAbbr({ req }),
      ExtDoc: globalIndex,
      RequestDeliveryDate: getCurrentDateForNAV(),
      SalesLine: SalesLine,
      org: req.user.org,
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
    let query = { org: req.user.org };
    if (searchKey != "" && searchKey != "undefined") {
      query = {
        $or: [
          { DocumentNo: { $regex: searchKey, $options: "i" } },
          { SalespersonCode: { $regex: searchKey, $options: "i" } },
          { ExtDoc: { $regex: searchKey, $options: "i" } },
          { SellToCustNo: { $regex: searchKey, $options: "i" } },
          { return_value: { $regex: searchKey, $options: "i" } },
        ],
      };
    }

    const salesOrders = await SalesOrder.find(query)
      .select("_id return_value DocumentNo RequestDeliveryDate ")
      .lean();
    return res.status(200).json(salesOrders);
  } catch (error) {
    console.log(error);
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

export default router;
