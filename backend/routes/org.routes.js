import { Router } from "express";
import Org from "../models/Organization.model.js";
// import authorizeSupertenant from "../middlewares/authoririzeSupertenant.js";
import authenticate from "../middlewares/authenticate.js";

const router = Router();

router.post(
  "/createOrg",
  authenticate,
  // authorizeSupertenant,
  async (req, res) => {
    const {
      organizationName,
      AD_HOST,
      AD_PORT,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_SECURE,
      AD_DOMAIN,
      AD_BASE_DN,
    } = req.body;

    // Validasi minimum
    if (!organizationName || !AD_HOST || !AD_PORT) {
      return res.status(400).json({
        message: "Mohon lengkapi nama organisasi dan kredensial AD",
      });
    }

    try {
      // Cek jika sudah ada organisasi dengan nama sama
      const orgExisting = await Org.findOne({ organizationName });
      if (orgExisting) {
        return res.status(400).json({
          message: "Organisasi dengan nama ini sudah ada",
        });
      }

      // Buat object organisasi baru
      const newOrg = new Org({
        organizationName,
        AD_HOST,
        AD_PORT,
        AD_DOMAIN,
        AD_BASE_DN,
        EMAIL_USER,
        EMAIL_PASS,
        EMAIL_HOST,
        EMAIL_PORT,
        EMAIL_SECURE,
        createdBy: req?.user?._id,
        owners: [req.user._id],
        members: [req?.user?._id],
      });

      await newOrg.save();

      return res.status(200).json({
        message: "Berhasil membuat organisasi baru",
        data: newOrg,
      });
    } catch (error) {
      console.error("Error creating organization:", error);
      return res.status(500).json({
        message: "Terjadi kesalahan di server",
      });
    }
  }
);

router.get("/getOrgById/:_id", async (req, res) => {
  const _id = req.params._id;
  try {
    const orgDB = await Org.findById(_id).select("organizationName _id");
    return res.json({ message: "berhasil ambil data", data: orgDB });
  } catch (error) {
    console.log(error);
    return res.status(400).json({ message: "failed" });
  }
});

router.get("/getAllOrg", async (req, res) => {
  const search = req.query.search;

  let query = {};
  if (search && search != "*") {
    query = {
      organizationName: { $regex: "^" + search, $options: "i" },
    };
  }
  try {
    const orgList = await Org.find(query).select("organizationName").limit(5);

    res.json({
      message: "berhasil ambil data",
      data: orgList,
    });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

router.get("/getAllOrgSuperTenant", authenticate, async (req, res) => {
  const { search, limit, skip } = req.query;

  let query = {};
  if (search) {
    query = {
      organizationName: { $regex: "^" + search, $options: "i" },
    };
  }
  try {
    const orgList = await Org.find(query)
      .populate("createdBy", "username")
      .select(
        "-__v -AD_HOST -AD_PORT -EMAIL_USER -EMAIL_PASS -EMAIL_HOST -EMAIL_PORT -EMAIL_SECURE"
      )
      .limit(limit || 10)
      .skip(skip || 0);

    res.json({
      message: "berhasil ambil data",
      data: orgList,
    });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

router.delete(
  "/disableOrg/:_id",
  authenticate,
  // authorizeSupertenant,
  async (req, res) => {
    const _id = req.params._id;

    try {
      let updatedOrg = await Org.findOne(
        // Tambahkan variabel untuk menangkap hasilnya
        { _id }
      );

      if (!updatedOrg) {
        // Tambahkan pengecekan apakah organisasi ditemukan
        return res.status(404).json({
          message: "Organization not found.", // Pesan yang lebih spesifik
        });
      }

      updatedOrg.isDisabled = !updatedOrg.isDisabled;

      await updatedOrg.save();
      return res.json({
        message: "Organization disabled successfully.", // Pesan yang lebih jelas
        data: updatedOrg, // Opsional: kirim data organisasi yang sudah diupdate
      });
    } catch (error) {
      console.error("Error disabling organization:", error); // Gunakan console.error dan pesan yang lebih deskriptif
      // Periksa jika error karena format _id yang tidak valid (misal, ObjectId yang salah)
      if (error.name === "CastError" && error.path === "_id") {
        return res.status(400).json({
          message: "Invalid organization ID format.",
        });
      }
      return res.status(500).json({
        message: "Internal server error while disabling organization.", // Pesan lebih deskriptif
      });
    }
  }
);

router.delete(
  "/deleteOrg/:_id",
  authenticate,
  // authorizeSupertenant,
  async (req, res) => {
    const _id = req.params._id;

    try {
      const deletedOrg = await Org.findOneAndDelete({ _id }); // Ganti nama variabel jadi deletedOrg

      if (deletedOrg) {
        // Periksa apakah dokumen ditemukan dan dihapus
        return res.json({
          message: "Organization deleted successfully.", // Pesan yang lebih jelas
          data: deletedOrg, // Opsional: kirim data organisasi yang dihapus
        });
      } else {
        return res.status(404).json({
          // Jika tidak ditemukan, return 404
          message: "Organization not found or could not be deleted.", // Pesan yang lebih spesifik
        });
      }
    } catch (error) {
      console.error("Error deleting organization:", error); // Gunakan console.error dan pesan yang lebih deskriptif
      // Periksa jika error karena format _id yang tidak valid
      if (error.name === "CastError" && error.path === "_id") {
        return res.status(400).json({
          message: "Invalid organization ID format.",
        });
      }
      return res.status(500).json({
        message: "Internal server error while deleting organization.", // Pesan lebih deskriptif
      });
    }
  }
);

export default router;
