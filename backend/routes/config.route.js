import { Router } from "express";
import nodemailer from "nodemailer";
import Org from "../models/Organization.model.js";
import {
  ORG_CONFIG_PASSWORD_FIELDS,
  ORG_CONFIG_PUBLIC_SELECT,
  ORG_SMTP_SELECT,
  getPasswordConfiguredFlags,
  pickAllowedConfigUpdate,
  stripOrgPasswordFields,
} from "../utils/orgConfigFields.js";

const router = Router();

router.get("/all", async (req, res) => {
  try {
    const org = await Org.findById(req.user.org).select(ORG_CONFIG_PUBLIC_SELECT);
    const passwordSource = await Org.findById(req.user.org).select(
      ORG_CONFIG_PASSWORD_FIELDS.join(" "),
    );

    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil konfigurasi LDAP organisasi.",
      data: org,
      passwordConfigured: getPasswordConfiguredFlags(passwordSource),
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

router.put("/all", async (req, res) => {
  try {
    const orgId = req.user.org;
    const filteredData = pickAllowedConfigUpdate(req.body);

    if (!Object.keys(filteredData).length) {
      return res.status(400).json({
        message: "Tidak ada field konfigurasi yang diperbarui.",
      });
    }

    const updatedOrg = await Org.findOneAndUpdate(
      { _id: orgId },
      { $set: filteredData },
      { new: true },
    ).select(ORG_CONFIG_PUBLIC_SELECT);

    if (!updatedOrg) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.json({
      message: "Berhasil mengubah konfigurasi organisasi.",
      data: stripOrgPasswordFields(updatedOrg),
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

/** Verify SMTP settings (and optionally send a short test mail). */
router.post("/smtp/test", async (req, res) => {
  try {
    const org = await Org.findById(req.user.org).select(ORG_SMTP_SELECT);
    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }
    if (!org.EMAIL_HOST || !org.EMAIL_USER || !org.EMAIL_PASS) {
      return res.status(400).json({
        message: "SMTP belum lengkap (HOST / USER / PASS).",
      });
    }

    const to = String(req.body?.to || org.EMAIL_USER).trim();
    const transporter = nodemailer.createTransport({
      host: org.EMAIL_HOST,
      port: Number(org.EMAIL_PORT) || 587,
      secure: Boolean(org.EMAIL_SECURE),
      auth: { user: org.EMAIL_USER, pass: org.EMAIL_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      family: 4,
    });

    await transporter.verify();
    const info = await transporter.sendMail({
      from: org.EMAIL_USER,
      to,
      subject: `[CSI System Hub] Uji SMTP — ${org.organizationName || "org"}`,
      text: `Ini email uji dari System Hub.\nWaktu: ${new Date().toISOString()}`,
    });

    return res.json({
      message: `SMTP OK — email uji dikirim ke ${to}`,
      data: { messageId: info.messageId, to },
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message || "Uji SMTP gagal",
    });
  }
});

export default router;
