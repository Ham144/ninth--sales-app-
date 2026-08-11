import { Router } from "express";
import { fetchingSoapToGetInventory } from "../utils/cron-product.js";

const router = Router();
router.get("/count", async (req, res) => {
  const { No, locationCode } = req.query;

  if (!No || !locationCode) {
    return res
      .status(400)
      .json({ message: "No dan locationCode harus diisi." });
  }

  try {
    const inventoryResult = await fetchingSoapToGetInventory(
      No,
      locationCode,
      req,
    );

    console.log("inventoryResult: ", inventoryResult, " of ", No, locationCode);

    return res.json({ inventoryResult });
  } catch (err) {
    res.status(500).json({ message: "Terjadi kesalahan server." });
  }
});

export default router;
