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

  let query = {};
  if (searchKey) {
    const escaped = escapeRegex(searchKey);
    query = {
      $or: [
        { No: { $regex: "^" + escaped, $options: "i" } },
        { Description: { $regex: escaped, $options: "i" } },
        { Description_2: { $regex: escaped, $options: "i" } },
        { Description_3: { $regex: escaped, $options: "i" } },
      ],
    };
  }

  if (
    req?.user?.description?.startsWith("SALES") &&
    req?.user?.description.split("_").length > 1
  ) {
    const getVendor = req?.user?.description.split("_")[1];

    query = {
      ...query,
      $and: [
        { Brand: { $regex: getVendor, $options: "i" } }, // cocok dengan vendor
        { Brand: { $nin: ["", null] } }, // tidak kosong/null
        { Brand: { $exists: true } }, // field harus ada
      ],
    };
  }

  try {
    const total = await Product.countDocuments(query);
    const data = await Product.find(query)
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

    let updatedProduct = await Product.findOne({ No });
    if (!updatedProduct) {
      updatedProduct = new Product({ No });
    }

    return res.json({ stockResult });
  } catch (err) {
    console.error("Gagal getStock:", err);
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});

export default router;
