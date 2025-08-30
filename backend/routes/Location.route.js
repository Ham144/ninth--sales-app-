import { Router } from "express";
import Location from "../models/Location.model.js";

const router = Router();
router.get("/list", async (req, res) => {
  const { searchKey } = req.query;

  let query = {};

  try {
    if (searchKey) {
      query = {
        name: { $regex: new RegExp(`^${searchKey}`, "i") },
      };
    }
    const data = await Location.find(query);
    return res.json({
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default router;
