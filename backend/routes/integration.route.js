import { Router } from "express";
import IntegrationKeyModel from "../models/IntegrationKey.model.js";
import crypto from "crypto";

const router = Router();

router.get("/integration", async (req, res) => {
  try {
    //sekalian hapus yang udah expired
    // Cukup tambahkan minus (-) di depan field yang mau dibuang
    const safeData = await IntegrationKeyModel.find().select("-apiKey -seen");

    return res.json({ message: "berhasil ambil data", data: safeData });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/integration", async (req, res) => {
  const { projectName, appSource } = req.body;
  try {
    if (req.user.description != "IT") {
      return res.status(403).json({
        message: "Only IT can create API key",
      });
    }
    const random = crypto.randomBytes(16).toString("hex");
    const xapiKey = "CSIOPEN_" + random;

    const data = await IntegrationKeyModel.create({
      apiKey: xapiKey,
      expiredAt: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 year
      status: "active",
      createdAt: new Date(),
      projectName: projectName,
      appSource: appSource,
    });

    return res.json({
      data: {
        apiKey: data.apiKey,
        expiredAt: data.expiredAt,
        projectName: data.projectName,
        appSourceTxt: data.appSource,
      },
    });
  } catch (error) {
    if (error.status == 11000) {
      return res.status(400).json({ message: "Project name already exist" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/integration/:id", async (req, res) => {
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
