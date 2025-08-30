import { Router } from "express";
import nodemailer from "nodemailer";
import Org from "../models/Organization.model.js";

const router = Router();

//dapatkan semua field konfigurasi dari Organization model
router.get("/all", async (req, res) => {
  try {
    const org = await Org.findById(req.user.org).select(
      "AD_HOST AD_PORT AD_DOMAIN AD_BASE_DN EMAIL_USER EMAIL_HOST EMAIL_PORT EMAIL_SECURE SOAP_PRODUCT_URL SOAP_PRODUCT_USERNAME SOAP_PRODUCT_SOAPACTION SOAP_PRODUCT_XMLNS SOAP_STOCK_URL SOAP_STOCK_USERNAME SOAP_STOCK_SOAPACTION SOAP_STOCK_XMLNS SOAP_CUSTOMER_URL SOAP_CUSTOMER_USERNAME SOAP_CUSTOMER_SOAPACTION SOAP_CUSTOMER_XMLNS SOAP_TRANSACTION_URL SOAP_TRANSACTION_USERNAME SOAP_TRANSACTION_SOAPACTION SOAP_TRANSACTION_XMLNS SOAP_PEMBAYARANTERTUNDA_URL SOAP_PEMBAYARANTERTUNDA_USERNAME SOAP_PEMBAYARANTERTUNDA_SOAPACTION SOAP_PEMBAYARANTERTUNDA_XMLNS"
    );

    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil konfigurasi LDAP organisasi.",
      data: org,
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

//edit
router.put("/all", async (req, res) => {
  try {
    const orgId = req.user.org;

    // Hapus field dengan value kosong ("" atau null)
    const filteredData = Object.fromEntries(
      Object.entries(req.body).filter(([_, value]) => value !== "")
    );

    // Update hanya field yang ada di filteredData
    const updatedOrg = await Org.findOneAndUpdate(
      { _id: orgId },
      { $set: filteredData },
      { new: true, upsert: false }
    );

    return res.json({
      message: "Berhasil mengubah konfigurasi organisasi.",
      data: updatedOrg,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

//test email
router.post("/smtp/test", async (req, res) => {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
    recipient,
  } = req.body;

  console.log(req.body);
  if (!recipient) {
    return res.status(400).json({ message: "Email penerima diperlukan." });
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Verifikasi koneksi
    await transporter.verify();

    // Kirim email
    await transporter.sendMail({
      from: `"CSI System" <${EMAIL_USER}>`,
      to: recipient,
      subject: "SMTP Configuration Test",
      text: "This is a test email to verify your SMTP configuration. If you received this, it works!",
      html: "<b>This is a test email to verify your SMTP configuration.</b><p>If you received this, it works!</p>",
    });

    return res
      .status(200)
      .json({ message: `Email percobaan berhasil dikirim ke ${recipient}` });
  } catch (error) {
    console.error("SMTP Test Error:", error);
    return res.status(500).json({
      message: "Gagal mengirim email percobaan.",
      error: error.message,
    });
  }
});

export default router;
