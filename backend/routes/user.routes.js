import { Router } from "express";
import UserRefrensi from "../models/User.model.js";

const router = Router();

import mongoose from "mongoose";
// ...
router.get("/findById/:id", async (req, res) => {
  const id = req.params.id;
  if (!id || id === "null" || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "id valid tidak" });
  }
  const user = await UserRefrensi.findById(
    new mongoose.Types.ObjectId(id)
  ).select("-otpExpired -otp -_2faSecret -password -refreshToken");
  return res.json(user);
});

router.get("/findByUsername/:username", async (req, res) => {
  try {
    const username = req.params.username?.trim();
    if (!username)
      return res.status(400).json({ message: "Username tidak diberikan" });

    if (!username || username === "null" || username.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Parameter username tidak boleh kosong",
      });
    }

    const user = await UserRefrensi.findOne({
      username: username?.trim()?.toLowerCase(),
    }).select("-otpExpired -otp -_2faSecret -password -refreshToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/findManyByIds", async (req, res) => {
  const { ids } = req.body;
  const users = await UserRefrensi.find({ _id: { $in: ids } }).select(
    "username email role org phone"
  );
  return res.json(users);
});

router.get("/findByOrganization/:org", async (req, res) => {
  const { org } = req.params;
  const users = await UserRefrensi.find({ org }).select(
    "-otpExpired -otp -_2faSecret -password -refreshToken"
  );
  return res.json(users);
});

export default router;
