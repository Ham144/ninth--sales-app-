import { Router } from "express";
import Org from "../models/Organization.model.js";

const router = Router();

router.get("/findById/:id", async (req, res) => {
  const { id } = req.params;
  const org = await Org.findById(id);
  return res.json(org);
});

export default router;
