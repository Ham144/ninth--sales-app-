import mongoose from "mongoose";
import { Router } from "express";
import Org from "../models/Organization.model.js";
import {
  ORG_SMTP_SELECT,
  getMissingConfigFields,
  ORG_SMTP_FIELDS,
  pickSotConfigUpdate,
} from "../utils/orgConfigFields.js";

const router = Router();

const findOrgByIdOrName = async (idOrName, select = "") => {
  const raw = decodeURIComponent(String(idOrName || "").trim());
  if (!raw) return null;

  let query = select ? Org.findById(raw).select(select) : Org.findById(raw);
  if (mongoose.isValidObjectId(raw)) {
    const byId = await query.lean();
    if (byId) return byId;
  }

  const byNameQuery = select
    ? Org.findOne({ organizationName: raw }).select(select)
    : Org.findOne({ organizationName: raw });

  return byNameQuery.lean();
};

const buildSmtpPayload = (org) => ({
  _id: org._id,
  organizationName: org.organizationName ?? null,
  EMAIL_HOST: org.EMAIL_HOST ?? null,
  EMAIL_PORT: org.EMAIL_PORT ?? null,
  EMAIL_SECURE: org.EMAIL_SECURE ?? null,
  EMAIL_USER: org.EMAIL_USER ?? null,
  EMAIL_PASS: org.EMAIL_PASS ?? null,
});

router.get("/findById/:id", async (req, res) => {
  try {
    const org = await findOrgByIdOrName(req.params.id);

    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.json(org);
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil organisasi." });
  }
});

router.get("/smtpConfig/:id", async (req, res) => {
  try {
    const org = await findOrgByIdOrName(req.params.id, ORG_SMTP_SELECT);

    if (!org) {
      return res.status(404).json({
        message: "Organisasi tidak ditemukan di MIDCSI.",
        hint: "Pastikan memakai _id dari GET /api/v1/sot/organization/getAllOrg, bukan _id org SNB.",
        requested: req.params.id,
      });
    }

    const missingSmtpFields = getMissingConfigFields(org, ORG_SMTP_FIELDS);
    const payload = buildSmtpPayload(org);

    if (missingSmtpFields.length) {
      return res.status(422).json({
        message: "Konfigurasi SMTP tidak lengkap di MIDCSI.",
        missingFields: missingSmtpFields,
        ...payload,
      });
    }

    return res.json(payload);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Gagal mengambil konfigurasi SMTP." });
  }
});

router.get("/smtpStatus", async (_req, res) => {
  try {
    const orgs = await Org.find({}).select(ORG_SMTP_SELECT).lean();

    return res.json(
      orgs.map((org) => ({
        ...buildSmtpPayload(org),
        configured: getMissingConfigFields(org, ORG_SMTP_FIELDS).length === 0,
        missingFields: getMissingConfigFields(org, ORG_SMTP_FIELDS),
      })),
    );
  } catch (error) {
    return res.status(500).json({ message: "Gagal mengambil status SMTP." });
  }
});

router.get("/getAllOrg", async (_req, res) => {
  try {
    const orgs = await Org.find().lean();
    return res.json(orgs);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Gagal mengambil daftar organisasi." });
  }
});

router.put("/updateConfig/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const filteredData = pickSotConfigUpdate(req.body);

    if (!Object.keys(filteredData).length) {
      return res.status(400).json({
        message: "Tidak ada field konfigurasi yang diperbarui.",
      });
    }

    const existing = await findOrgByIdOrName(id);
    if (!existing) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    const updatedOrg = await Org.findOneAndUpdate(
      { _id: existing._id },
      { $set: filteredData },
      { new: true },
    ).lean();

    return res.json({
      message: "Berhasil mengubah konfigurasi organisasi.",
      data: updatedOrg,
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal memperbarui konfigurasi." });
  }
});

export default router;
