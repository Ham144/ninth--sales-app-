import { Router } from "express";
import UserRefrensi from "../models/User.model.js";

const router = Router();

router.get("/findById/:id", async (req, res) => {
  const user = await UserRefrensi.findById(req?.params?.id).select(
    "-otpExpired -otp -_2faSecret -password -refreshToken"
  );
  return res.json(user);
});

router.get("/findByUsername/:username", async (req, res) => {
  try {
    const username = req.params.username?.trim();
    if (!username)
      return res.status(400).json({ message: "Username tidak diberikan" });

    // Escape karakter regex spesial
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const user = await UserRefrensi.find({
      username: { $regex: escaped, $options: "i" }, // i = case-insensitive
    }).select("-otpExpired -otp -_2faSecret -password -refreshToken");

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
