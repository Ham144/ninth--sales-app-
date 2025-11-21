import { Router } from "express";
import Product from "../models/product.model.js";
import escapeRegex from "../utils/excapeRegexInject.js";
import { fetchingSoapToGetStock } from "../utils/cron-product.js";

const router = Router();

//ini untuk search sekalian menampilkan detail
router.get("/list", async (req, res) => {
  const searchKey = req.query.searchKey || "";
  const skip = parseInt(req.query.skip) || 0;
  const limit = parseInt(req.query.limit) || 10;

  let query = { Blocked_MA: false };
  let andConditions = [];

  if (searchKey) {
    const escaped = escapeRegex(searchKey);
    andConditions.push({
      $or: [
        { No: { $regex: escaped, $options: "i" } },
        { Description: { $regex: escaped, $options: "i" } },
        { Description_2: { $regex: escaped, $options: "i" } },
        { Description_3: { $regex: escaped, $options: "i" } },
      ],
    });
  }

  const myVendor =
    req?.user?.description?.startsWith("SALES") &&
    req?.user?.description.split("_").length > 1
      ? req?.user?.description.split("_")[1]
      : null;

  if (myVendor) {
    andConditions.push(
      { Brand: { $regex: myVendor, $options: "i" } }, // cocok dengan vendor
      { Brand: { $exists: true } } // field harus ada
    );
  }

  // Jika ada kondisi $and, gabungkan dengan query utama
  if (andConditions.length > 0) {
    query = {
      $and: [{ Blocked_MA: false }, ...andConditions],
    };
  }

  try {
    const cencoredSMD =
      "-Retail -Web -LK -JD_Price -MP_Price -OS_Price -NO_NIK";
    const total = await Product.countDocuments(query);
    const data = await Product.find(query)
      .select(myVendor ? cencoredSMD : "-__v")
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

router.get("/getStock", async (req, res) => {
  const { No, locationCode } = req.query;

  if (!No || !locationCode) {
    return res
      .status(400)
      .json({ message: "No dan locationCode harus diisi." });
  }

  try {
    const stockResult = await fetchingSoapToGetStock(No, locationCode, req);

    //jika SMD sensor stock
    // const vendor = req?.user?.description?.split("_")[1];
    // if (vendor) {
    //   return res.json({ stockResult: "SMD NOT GRANTED" });
    // }

    return res.json({ stockResult });
  } catch (err) {
    console.error("Gagal getStock:", err);
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});

//sot
router.get("/sot/getByNo:no", async (req, res) => {
  const no = req.params?.no;
  const product = await Product.findOne({ No: no });
  return res.json(product);
});

router.get("/sot/getById/:id", async (req, res) => {
  const id = req.params?.id;
  const product = await Product.findById(id);
  return res.json(product);
});

router.post("/sot/geByNos", async (req, res) => {
  const nos = req.body?.nos;
  return await Product.find({ No: { $in: nos } });
});

export default router;
