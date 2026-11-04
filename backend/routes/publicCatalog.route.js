import { Router } from "express";
import Product from "../models/product.model.js";
import Location from "../models/Location.model.js";
import escapeRegex from "../utils/excapeRegexInject.js";
import { retrieveKnowledge } from "../utils/knowledgeIndex.js";
import {
  normalizeProductOrganization,
  productOrganizationQuery,
} from "../utils/productOrganization.js";
import {
  PUBLIC_PRODUCT_FIELDS,
  availabilityFromProduct,
  publicKnowledgeFilter,
  toPublicProduct,
} from "../utils/publicCatalog.js";

const router = Router();

const readOrganization = (req, res) => {
  const organization = normalizeProductOrganization(
    req.query.organization ?? "csi",
  );
  if (!organization) {
    res.status(400).json({ message: "organization harus csi atau ril" });
    return null;
  }
  return organization;
};

router.get("/products", async (req, res) => {
  const organization = readOrganization(req, res);
  if (!organization) return;

  const searchKey = String(req.query.searchKey || "").trim();
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);

  if (searchKey && searchKey.length < 2) {
    return res.json({
      data: [],
      total: 0,
      observedAt: new Date().toISOString(),
      message: "Minimal 2 karakter untuk pencarian",
    });
  }

  const andConditions = [productOrganizationQuery(organization)];
  if (searchKey.length === 2) {
    andConditions.push({
      No: { $regex: `^${escapeRegex(searchKey)}$`, $options: "i" },
    });
  } else if (searchKey.length > 2) {
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

  try {
    const query = { $and: andConditions };
    const total = await Product.countDocuments(query);
    const rows = await Product.find(query)
      .select(PUBLIC_PRODUCT_FIELDS.join(" "))
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      data: rows.map(toPublicProduct),
      total,
      observedAt: new Date().toISOString(),
      message: "ok",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/products/:no", async (req, res) => {
  const organization = readOrganization(req, res);
  if (!organization) return;

  try {
    const product = await Product.findOne({
      $and: [{ No: req.params.no }, productOrganizationQuery(organization)],
    })
      .select(PUBLIC_PRODUCT_FIELDS.join(" "))
      .lean();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });
    return res.json({
      data: toPublicProduct(product),
      observedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/availability", async (req, res) => {
  const organization = readOrganization(req, res);
  if (!organization) return;
  const no = String(req.query.No || req.query.no || "").trim();
  if (!no) return res.status(400).json({ message: "No wajib" });

  try {
    const product = await Product.findOne({
      $and: [{ No: no }, productOrganizationQuery(organization)],
    }).lean();
    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });
    return res.json({ data: availabilityFromProduct(product) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/locations", async (_req, res) => {
  try {
    const rows = await Location.find({}).select("name").lean();
    return res.json({
      data: rows.map((row) => ({ name: row.name })),
      observedAt: new Date().toISOString(),
      note: "Nama titik yang menerima kunjungan langsung. Bukan angka stok.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/knowledge/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 8);
  if (q.length < 2) return res.status(400).json({ message: "q minimal 2 karakter" });

  try {
    const result = await retrieveKnowledge({
      q,
      top_k: limit,
      visibility: publicKnowledgeFilter().visibility,
    });
    return res.json({
      query: q,
      mode: result.mode,
      observedAt: new Date().toISOString(),
      data: result.data.map((doc) => ({
        slug: doc.slug,
        title: doc.title,
        visibility: doc.visibility,
        text: String(doc.text || "").slice(0, 1200),
        score: doc.score,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
