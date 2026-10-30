import { Router } from "express";
import redisService from "../utils/redisService.js";
import { loadRequestOrganization } from "../utils/resolveRequestOrg.js";
import { readSalesOrderNavStatus } from "../utils/salesOrderNavStatus.js";

const router = Router();

router.get("/statusNav", async (req, res) => {
  const { return_value } = req.query;

  try {
    if (!return_value) {
      return res.status(400).json({
        error: true,
        message: "return_value harus diisi",
      });
    }

    const { org, orgId, source } = await loadRequestOrganization(req);

    if (!org) {
      return res.status(404).json({
        error: true,
        message: "Organisasi tidak ditemukan",
        orgId,
        source,
      });
    }
    const result = await readSalesOrderNavStatus({
      returnValue: return_value,
      org,
      redis: redisService,
    });
    return res.json(result);
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: true,
      message: error?.message || "Internal server error",
      missingFields: error?.missingFields,
    });
  }
});

export default router;
