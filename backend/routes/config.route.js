import { Router } from "express";
import Org from "../models/Organization.model.js";
import {
  ORG_CONFIG_PASSWORD_FIELDS,
  ORG_CONFIG_PUBLIC_SELECT,
  getPasswordConfiguredFlags,
  pickAllowedConfigUpdate,
  stripOrgPasswordFields,
} from "../utils/orgConfigFields.js";

const router = Router();

router.get("/all", async (req, res) => {
  try {
    const org = await Org.findById(req.user.org).select(ORG_CONFIG_PUBLIC_SELECT);
    const passwordSource = await Org.findById(req.user.org).select(
      ORG_CONFIG_PASSWORD_FIELDS.join(" "),
    );

    if (!org) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.status(200).json({
      message: "Berhasil mengambil konfigurasi LDAP organisasi.",
      data: org,
      passwordConfigured: getPasswordConfiguredFlags(passwordSource),
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

router.put("/all", async (req, res) => {
  try {
    const orgId = req.user.org;
    const filteredData = pickAllowedConfigUpdate(req.body);

    if (!Object.keys(filteredData).length) {
      return res.status(400).json({
        message: "Tidak ada field konfigurasi yang diperbarui.",
      });
    }

    const updatedOrg = await Org.findOneAndUpdate(
      { _id: orgId },
      { $set: filteredData },
      { new: true },
    ).select(ORG_CONFIG_PUBLIC_SELECT);

    if (!updatedOrg) {
      return res.status(404).json({ message: "Organisasi tidak ditemukan." });
    }

    return res.json({
      message: "Berhasil mengubah konfigurasi organisasi.",
      data: stripOrgPasswordFields(updatedOrg),
    });
  } catch (error) {
    return res.status(500).json({ message: "Gagal, internal server error." });
  }
});

export default router;
