import { Router } from "express";
import { fetchData } from "../utils/soap-util.js";
import { requestSalesOrderXml } from "../xml.js";
import xml2js from "xml2js";
import generateGlobalIndex from "../utils/generateGlobalIndex.js";
import { getCurrentDateForNAV } from "../utils/getCurrentDateTanggalBlnThn.js";
import GetMyOrganizationAbbr from "../utils/getMyOrganizationAbbr.js";
import SalesOrder from "../models/SalesOrder.model.js";
import Customer from "../models/Customer.model.js";
import TemporarySalesOrder from "../models/temporarySalesOrder.model.js";
import mongoose from "mongoose";
import Location from "../models/Location.model.js";
import UserRefrensi from "../models/User.model.js";
import Product from "../models/product.model.js";
import redisService from "../utils/redisService.js";

const router = Router();

//hanya butuh req.user._id requestor
export const requestSalesOrder = async ({
  DocumentNo,
  SellToCustNo,
  ExtDoc,
  RequestDeliveryDate,
  Keterangan,
  SalesLine,
  LocationCode,
  AreaCode,
  req,
}) => {
  try {
    // lengkapi requestor asli

    const requestor = await UserRefrensi.findById(req.user._id).populate("org");
    if (!requestor) {
      return { error: true, message: "Requestor tidak ditemukan" };
    }

    // const org = await Org.findById(req.user.org).select(
    //   "SOAP_TRANSACTION_URL SOAP_TRANSACTION_USERNAME SOAP_TRANSACTION_PASSWORD SOAP_TRANSACTION_SOAPACTION SOAP_TRANSACTION_XMLNS"
    // );

    const {
      SOAP_TRANSACTION_URL,
      SOAP_TRANSACTION_USERNAME,
      SOAP_TRANSACTION_PASSWORD,
      SOAP_TRANSACTION_SOAPACTION,
      SOAP_TRANSACTION_XMLNS,
    } = requestor.org;

    if (
      !SOAP_TRANSACTION_URL ||
      !SOAP_TRANSACTION_USERNAME ||
      !SOAP_TRANSACTION_PASSWORD ||
      !SOAP_TRANSACTION_SOAPACTION
    ) {
      console.log("konfigurasi SOAP Transaction tidak lengkap");
      return null;
    }

    //penentuan noseries
    const vendor = requestor.description?.split("_")[1];
    let NoSeries = "SO-SMA";
    if (vendor) {
      NoSeries = "SO-SMD";
    }

    const xml = requestSalesOrderXml({
      DocumentNo,
      SellToCustNo,
      ExtDoc,
      RequestDeliveryDate,
      SalesLine,
      Keterangan,
      LocationCode,
      AreaCode,
      SOAP_TRANSACTION_XMLNS,
      NoSeries: NoSeries,
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
  const {
    customer: customerObj,
    products,
    tempToDeleteId,
    requestDeliveryDate,
    frontendSession,
    keterangan,
    locationCode,
    isPending = false,
  } = req.body;

  try {
    // req.user sudah di-set dari middleware authenticate

    const userInfo = req?.user;

    const globalIndex = await generateGlobalIndex(req, "globalIndex");

    const vendor =
      userInfo?.description?.startsWith("SALES") &&
      userInfo?.description?.split("_")[1];

    if (!globalIndex)
      return res.status(500).json({ message: "Gagal membuat global index" });

    //kondisi menerima customer boleh hanya No atau objek lengkap
    let customer;
    if (customerObj?.No && customerObj?.Name) {
      customer = customerObj;
    } else {
      customer = await Customer.findOne({ No: customerObj });
    }

    // Periksa dan lengkapi data product dari DB jika tidak lengkap
    let enrichedProducts = await Promise.all(
      products.map(async (item) => {
        // Jika product sudah memiliki price dan Name, langsung return
        if (item.price !== undefined && item.Name !== undefined) {
          return item;
        }

        // Ambil data lengkap dari database
        const product = await Product.findOne({ No: item.No });
        if (!product) {
          throw new Error(
            `Product dengan No '${item.No}' tidak ditemukan di database`
          );
        }

        // Tentukan harga berdasarkan Customer_Price_Group
        const targetKey = customer.Customer_Price_Group?.toUpperCase();
        if (!targetKey) {
          throw new Error(`Customer tidak memiliki Customer_Price_Group`);
        }

        // Normalize keys jadi uppercase
        const normalizedProduct = Object.entries(product.toObject()).reduce(
          (acc, [key, value]) => {
            acc[key.toUpperCase()] = value;
            return acc;
          },
          {}
        );

        const matchedPrice = normalizedProduct[targetKey];

        // Validasi harga
        if (matchedPrice == null || Number(matchedPrice) === 0) {
          throw new Error(
            `Harga untuk Customer_Price_Group '${targetKey}' tidak ditemukan atau 0 untuk product '${item.No}'`
          );
        }

        return {
          ...item,
          Name: product.Name,
          price: Number(matchedPrice),
          priceGroupKey: targetKey,
        };
      })
    );

    let SalesLine = [];
    for (let i = 0; i < enrichedProducts.length; i++) {
      SalesLine.push({
        DocumentNo: globalIndex,
        LineNo: (i + 1) * 1000,
        ItemNo: enrichedProducts[i].No || "",
        Qty: enrichedProducts[i].qty,
        UnitPrice: enrichedProducts[i].price || 0,
        LineDiscountAmount: 0,
        PromoCode: "",
      });
    }

    //area and location code matching
    let location;
    if (locationCode) {
      location = await Location.findOne({
        name: locationCode,
      }).select("name");
    } else {
      location = {
        name: customer.Location_Code,
      };
    }
    const before = location.name.split("_")[0];

    let after = location.name.split("_");

    if (after.length > 2) after = before.split("_").slice(0, 2).join("_");
    else if (after.length === 2)
      after = before.split("_").slice(0, 1).join("_");
    else after = location.name;

    //cegah pergantian location jika ada user.description.vendor
    if (vendor) {
      if (location.name != customer.Location_Code) {
        return res.status(400).json({
          message:
            "Location default dari customer, jangan mencoba mengganti. karena user anda spesifik PHILIPS",
        });
      }
    }

    const orderDate = new Date().toISOString().split("T")[0];
    const cleanForNAV = (str) => {
      return str.replace(/[&<>"'*%?\/\\|\{\}\[\]=#@~^;:\u0000-\u001F]/g, "-");
    };
    let salesOrderResponseXml;
    if (!isPending) {
      salesOrderResponseXml = await requestSalesOrder({
        DocumentNo: globalIndex,
        ExtDoc: req.user.username,
        SellToCustNo: customer.No,
        RequestDeliveryDate: requestDeliveryDate ?? getCurrentDateForNAV(),
        Keterangan: cleanForNAV(keterangan),
        LocationCode: location.name,
        AreaCode: after,
        SalesLine: SalesLine,
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
    }
    const SalesLineTotal = SalesLine.reduce((total, item) => {
      const lineTotal = (Number(item.UnitPrice) || 0) * (Number(item.Qty) || 0);
      return total + lineTotal;
    }, 0);

    const generatedSalesOrder = await SalesOrder.create({
      return_value:
        salesOrderResponseXml?.return_value ?? "waiting for approval",
      DocumentNo: globalIndex,
      customer: customer._id,
      ShiptToCode: customer.ShiptToCode || "",
      OrderDate: orderDate,
      LocationCode: location?.name || "",
      Dim1: after || "",
      CustomerPriceGrp: customer.Customer_Price_Group,
      SalespersonCode: customer.Salesperson_Code || "",
      NoSeries: await GetMyOrganizationAbbr({ req }),
      ExtDoc: req.user.username, //nama si user
      RequestDeliveryDate: requestDeliveryDate
        ? new Date(convertToISOConvertableDate(requestDeliveryDate))
        : new Date(convertToISOConvertableDate(getCurrentDateForNAV())),
      Keterangan: keterangan, //note tambahan dari frontend
      SalesLine: SalesLine,
      SalesLineTotal: SalesLineTotal,
      org: req.user.org,
      createdBy: req.user._id,
      isPending: isPending,
    });

    await TemporarySalesOrder.findByIdAndDelete(tempToDeleteId);
    await TemporarySalesOrder.findOneAndDelete({
      frontendSession: frontendSession,
    });

    return res.status(200).json(generatedSalesOrder);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/confirm", async (req, res) => {
  const { id } = req.body;

  try {
    const pendingSalesOrder = await SalesOrder.findById(id).populate(
      "customer",
      "No Location_Code"
    );

    if (!pendingSalesOrder) {
      return res
        .status(404)
        .json({ message: "Pending Sales Order Tidak Ditemukan" });
    }

    if (!pendingSalesOrder?.customer?.No) {
      return res
        .status(400)
        .json({ message: "Customer untuk Sales Order tidak ditemukan" });
    }

    const requestDeliveryDate =
      formatDateToDDMMYYYY(pendingSalesOrder.RequestDeliveryDate) ||
      getCurrentDateForNAV();
    const keterangan = pendingSalesOrder.Keterangan ?? "";
    const SalesLine = pendingSalesOrder.SalesLine ?? [];
    const locationCode =
      pendingSalesOrder.LocationCode ||
      pendingSalesOrder.customer?.Location_Code ||
      "";
    const areaCode = pendingSalesOrder.Dim1 || "";

    if (SalesLine.length === 0) {
      return res.status(400).json({
        message: "SalesLine kosong, tidak dapat melanjutkan konfirmasi",
      });
    }

    const realRequestor = await UserRefrensi.findById(
      pendingSalesOrder.createdBy
    );
    req.user = realRequestor;

    const salesOrderResponseXml = await requestSalesOrder({
      DocumentNo: pendingSalesOrder.DocumentNo,
      ExtDoc: pendingSalesOrder.ExtDoc,
      SellToCustNo: pendingSalesOrder.customer.No,
      RequestDeliveryDate: requestDeliveryDate,
      Keterangan: keterangan,
      LocationCode: locationCode,
      AreaCode: areaCode,
      SalesLine: SalesLine,
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

    pendingSalesOrder.return_value =
      salesOrderResponseXml?.return_value ?? pendingSalesOrder.return_value;
    pendingSalesOrder.isPending = false;
    await pendingSalesOrder.save();

    await redisService.del(pendingSalesOrder?.return_value);

    return res.status(200).json(pendingSalesOrder);
  } catch (error) {
    console.log(error?.message);
    return res.status(500).json({ message: error?.message });
  }
});

router.get("/download", async (req, res) => {
  const { month, preview, return_valueType } = req.query;

  const userInfo = req.user;

  const vendor =
    userInfo?.description?.startsWith("SALES") &&
    userInfo?.description?.split("_")[1];

  // Normalisasi month: support 0-11 atau 1-12, default ke bulan berjalan
  const today = new Date();
  const year = today.getFullYear();
  let m = Number.isFinite(Number(month))
    ? parseInt(month, 10)
    : today.getMonth();
  if (m >= 1 && m <= 12) m = m - 1; // ubah 1-12 → 0-11
  if (m < 0 || m > 11 || Number.isNaN(m)) m = today.getMonth();

  // Range [awal bulan, awal bulan berikutnya)
  const from = new Date(year, m, 1);
  const to = new Date(year, m + 1, 1);

  try {
    const baseMatch = {
      OrderDate: { $gte: from, $lt: to },
      isPending: false,
    };

    if (return_valueType) {
      baseMatch.return_value = { $regex: return_valueType, $options: "i" };
    }

    let createdByFilter = [];
    if (vendor) {
      console.log(vendor);
      createdByFilter = await UserRefrensi.find({
        org: req.user.org,
        description: { $regex: new RegExp(`^SALES_${vendor}`, "i") },
      }).select("_id");

      if (createdByFilter?.length > 0) {
        createdByFilter = createdByFilter.map((item) => item._id);
      }
      baseMatch.createdBy = { $in: createdByFilter };
    }

    // Preview: ringan untuk tampilan list
    if (String(preview) === "true") {
      const data = await SalesOrder.find(baseMatch)
        .select("return_value customer OrderDate ExtDoc DocumentNo")
        .sort({ createdAt: -1 })
        .populate({ path: "customer", select: "No Name" })
        .lean();
      return res.status(200).json(data);
    }

    // Full: semua field dan populate referensi
    const data = await SalesOrder.find(baseMatch)
      .sort({ createdAt: -1 })
      .populate({
        path: "customer",
        select: "No Name Customer_Price_Group Salesperson_Code",
      })
      .populate({ path: "org", select: "organizationName" })
      .populate({ path: "createdBy", select: "username email" })
      .lean();

    return res.status(200).json(data);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

router.get("/list", async (req, res) => {
  const {
    searchKey,
    isPending = false,
    page = 1,
    return_valueType,
    extDoc,
  } = req.query;

  try {
    const myVendor =
      req?.user?.description?.startsWith("SALES") &&
      req?.user?.description.split("_").length > 1
        ? req?.user?.description.split("_")[1]
        : null;

    //jika IT maka munculkan SO
    let matchStage = { org: req.user.org };

    if (return_valueType && Boolean(isPending) === false) {
      matchStage.return_value = { $regex: return_valueType, $options: "i" };
    }
    if (extDoc?.length > 0) {
      const splitSelectedUserString = extDoc.split(",");

      matchStage.$or = splitSelectedUserString.map((str) => ({
        ExtDoc: { $regex: str, $options: "i" },
      }));
    }

    if (Boolean(isPending) === true) {
      matchStage.isPending = true;
    } else {
      matchStage.$or = [
        { isPending: { $exists: false } },
        { isPending: false },
        { isPending: null },
      ];
    }

    if (
      req.user.description !== "IT" &&
      req.user.role !== "supertenant" &&
      req.user.description !== "PROCUREMENT"
    ) {
      matchStage.createdBy = req.user._id;
    }
    let searchByCustomer = null;

    if (searchKey && searchKey !== "undefined") {
      searchByCustomer = await Customer.findOne({
        No: { $regex: searchKey, $options: "i" },
      }).select("_id");

      const orConditions = [
        { DocumentNo: { $regex: searchKey, $options: "i" } },
        { SalespersonCode: { $regex: searchKey, $options: "i" } },
        { ExtDoc: { $regex: searchKey, $options: "i" } },
        { SellToCustNo: { $regex: searchKey, $options: "i" } },
        { return_value: { $regex: searchKey, $options: "i" } },
      ];

      if (searchByCustomer?._id) {
        orConditions.push({ customer: searchByCustomer._id });
      }

      matchStage = {
        $and: [
          { org: req.user.org, ...matchStage },
          ...(req.user.description !== "IT" &&
          req.user.description !== "supertenant" &&
          req.user.description !== "PROCUREMENT"
            ? [{ createdBy: req.user._id }]
            : []),
          { $or: orConditions },
        ],
      };
    }

    const salesOrders = await SalesOrder.find(matchStage)
      .populate("customer", "Name No")
      .select(`${myVendor ? "-price" : "-__v"}`)
      .lean()
      .sort({ createdAt: -1 })
      .skip((page - 1) * 50)
      .limit(50);

    const total = await SalesOrder.countDocuments(matchStage);
    const totalPage = Math.ceil(total / 50);

    return res.status(200).json({ data: salesOrders, totalPage, total });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Kesalahan Server Internal" });
  }
});

router.get("/getById/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const myVendor =
      req?.user?.description?.startsWith("SALES") &&
      req?.user?.description.split("_").length > 1
        ? req?.user?.description.split("_")[1]
        : null;

    let salesOrder = await SalesOrder.findById(id)
      .select(`${myVendor ? "-SalesLineTotal" : "-__v"}`)
      .populate("customer", "No Name ")
      .lean();

    // Censor UnitPrice in SalesLine if myVendor is true
    if (myVendor && salesOrder?.SalesLine?.length > 0) {
      salesOrder.SalesLine = salesOrder?.SalesLine?.map((line) => ({
        ...line,
        UnitPrice: "SMD Not Granted",
      }));
    }

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
      frontendSession,
    });

    if (existingTemporarySalesOrder) {
      if (comment) {
        existingTemporarySalesOrder.comment = comment;
      }
      if (products) {
        console.log("updating temp");
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

router.delete("/temp/delete/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const temp = await TemporarySalesOrder.findById(id);
    if (!temp) {
      return res.json({ message: "Temporary Sales Telah dihapus" });
    }
    await TemporarySalesOrder.findByIdAndDelete(id);
    return res.json({ message: "Temporary Sales Order Berhasil Dihapus" });
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

router.delete("/delete", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: "id is required" });
  try {
    const so = await SalesOrder.findById(id);
    const isSentToNAV = so?.isPending == false;
    if (isSentToNAV) {
      return res.status(400).json({
        message: "Tidak boleh menghapus SO yang sudah dikirim ke NAV",
      });
    }
    await SalesOrder.findByIdAndDelete(id);

    return res.json({
      message: "Sales Order Berhasil Dihapus",
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message });
  }
});

const formatDateToDDMMYYYY = (dateValue) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default router;

export const convertToISOConvertableDate = (dateStr) => {
  // dari DD/MM/YYYY → YYYY-MM-DD
  const [day, month, year] = dateStr.split("/");
  return `${year}-${month}-${day}`;
};
