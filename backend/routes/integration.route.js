import { Router } from "express";
import IntegrationKeyModel from "../models/IntegrationKey.model.js";
import crypto from "crypto";

const router = Router();

router.get("/integration/list", async (req, res) => {
  try {
    let data = await IntegrationKeyModel.find({});

    //sekalian hapus yang udah expired
    await IntegrationKeyModel.deleteMany({ expiredAt: { $lt: new Date() } });

    data.forEach((item) => {
      item.apiKey = item.apiKey?.slice(0, 15) + ".....";
    });

    return res.json({ message: "berhasil ambil data", data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/generate/apiKey", async (req, res) => {
  try {
    if (req.user.description != "IT") {
      return res.status(403).json({
        message: "Only IT can create API key",
      });
    }
    const random = crypto.randomBytes(16).toString("hex");
    const xapiKey = "CSIOPEN_" + random;

    await IntegrationKeyModel.create({
      apiKey: xapiKey,
      expiredAt: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 year
      status: "active",
      createdAt: new Date(),
      projectName: req.body.projectName,
    });

    return res.json({ message: "berhasil membuat API key baru" });
  } catch (error) {
    if (error.status == 11000) {
      return res.status(400).json({ message: "Project name already exist" });
    }
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/getById/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await IntegrationKeyModel.findById(id);
    if (data.seen) {
      return res.json({
        message: "Anda Tidak bisa mengakses ini lagi, hapus dan buat baru",
        data,
      });
    }

    data.seen = true;
    await data.save();

    return res.json({ message: "Anda hanya bisa melihat ini satu kali", data });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await IntegrationKeyModel.findByIdAndDelete(id);
    return res.json({ message: "berhasil menghapus data" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
