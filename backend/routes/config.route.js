import { Router } from "express";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import Org from "../models/Organization.model.js";
import ApiSource from "../models/apiSource.model.js";

dotenv.config();

const router = Router();

router.get("/ad", async (req, res) => {
  try {
    const org = await Org.findById(req.user.org).select(
      "AD_HOST AD_PORT AD_DOMAIN AD_BASE_DN"
    );

    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil konfigurasi LDAP organisasi.",
      data: {
        AD_HOST: org.AD_HOST,
        AD_PORT: org.AD_PORT,
        AD_DOMAIN: org.AD_DOMAIN,
        AD_BASE_DN: org.AD_BASE_DN,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

//edit
router.put("/ad", async (req, res) => {
  const { AD_HOST, AD_PORT, AD_DOMAIN, AD_BASE_DN } = req.body;
  console.log(AD_HOST, AD_PORT, AD_DOMAIN, AD_BASE_DN);

  try {
    await Org.findOneAndUpdate(
      { _id: req.user.org },
      {
        AD_HOST,
        AD_PORT,
        AD_DOMAIN,
        AD_BASE_DN,
      }
    );

    return res.json({
      message: "Berhasil mengubah konfigurasi LDAP organisasi.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

router.get("/smtp", async (req, res) => {
  try {
    const data = await Org.findById(req.user.org).select(
      "EMAIL_USER  EMAIL_HOST EMAIL_PORT EMAIL_SECURE"
    );
    return res.json({ message: "berhasil mengambil konfigurasi smtp", data });
  } catch (error) {
    return res.status(400).json({ message: "internal server error" });
  }
});

router.put("/smtp", async (req, res) => {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE } =
    req.body;

  try {
    await Org.findOneAndUpdate(
      { _id: req.user.org },
      {
        EMAIL_USER,
        EMAIL_PASS,
        EMAIL_HOST,
        EMAIL_PORT,
        EMAIL_SECURE,
      }
    );

    return res.json({
      message: "Berhasil mengubah konfigurasi SMTP organisasi.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

router.post("/smtp/test", async (req, res) => {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
    recipient,
  } = req.body;

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

router.post("/set/apiSource", async (req, res) => {
  const { title, getProductUrl, getCustomerUrl, authLoginUrl, authFormData } =
    req.body;

  try {
    if (
      !title ||
      !authLoginUrl ||
      !getProductUrl ||
      !authLoginUrl ||
      !authFormData
    ) {
      return res.status(400).json({
        message:
          "Semua field harus diisi title,authLoginUrl, getProductUrl, authLoginUrl, authFormData",
      });
    }

    const configIsExisted = await ApiSource.find({});
    if (configIsExisted.length > 0) {
      return res
        .status(400)
        .json({ message: "API Source sudah ada, edit saja" });
    }

    const configApiSource = await ApiSource.create({
      title,
      getProductUrl,
      getCustomerUrl,
      authLoginUrl,
      authFormData,
    });

    return res.json({
      message: "Berhasil mengubah konfigurasi API organisasi.",
      data: configApiSource,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

export default router;
