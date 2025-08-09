import { Router } from "express";
import Product from "../models/product.model.js";
import escapeRegex from "../utils/excapeRegexInject.js";
import {
  fetchingSoapToGetStock,
  fieldsToSanitize,
} from "../utils/cron-product.js";

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
  const { No } = req.query;

  try {
    const product = await fetchingSoapToGetStock(No);

    if (!product) {
      return res.status(404).json({ message: "Produk tidak ditemukan." });
    }

    let updatedProduct = await Product.findOne({ No });
    if (!updatedProduct) {
      updatedProduct = new Product({ No });
    }

    const bulkOps = [];

    for (let field of fieldsToSanitize) {
      const oldVal = updatedProduct?.[field]; // undefined jika belum ada
      const newVal = product[field];

      //???? hapus aja entar . ga work
      for (let field of fieldsToSanitize) {
        if (product[field] !== undefined && product[field] !== null) {
          const parsed = parseFloat(product[field]);
          product[field] = isNaN(parsed) ? 0 : Math.floor(parsed);
        }
      }

      if (newVal !== undefined && newVal !== null && oldVal !== newVal) {
        bulkOps.push({
          updateOne: {
            filter: { No },
            update: { $set: { [field]: newVal } },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`Update selesai. Jumlah data berubah: ${bulkOps.length}`);
    } else {
      console.log("Tidak ada data yang berubah.");
    }

    res.json({
      message: "berhasil ambil data",
      data: product,
    });
  } catch (err) {
    console.error("Gagal getStock:", err);
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});

export default router;
