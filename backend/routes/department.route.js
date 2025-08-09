import { Router } from "express";
import Department from "../models/Department.model.js";
import UserRefrensi from "../models/User.model.js";
import mongoose from "mongoose";

const router = Router();

router.post("/create", async (req, res) => {
  const { name, members } = req.body;
  if (!req.user || !req.user.org) {
    return res.status(401).json({ message: "Unauthorized or missing org" });
  }

  try {
    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: "Members harus array dan tidak boleh kosong" });
    }
    if (!name) {
      return res.status(400).json({ message: "Nama department wajib diisi" });
    }

    const isExistingDepartment = await Department.findOne({
      name,
      org: req.user.org,
    }).lean();

    if (isExistingDepartment) {
      return res.status(400).json({ message: "Department already exists" });
    }

    //validasi semua members apakah valid
    const validMembers = await UserRefrensi.find({
      _id: { $in: members },
    }).lean();
    if (validMembers.length !== members.length) {
      return res.status(400).json({ message: "Beberapa userId tidak valid" });
    }

    //periksa member yang diikutsertakan apakah sudah terdaftar di department lain
    // periksa apakah ada anggota yang sudah tergabung di department lain dalam org ini
    const departmentsWithMembers = await Department.find({
      org: req.user.org,
      members: { $in: members },
    }).lean();

    if (departmentsWithMembers.length > 0) {
      const usedMemberIds = new Set();
      departmentsWithMembers.forEach((dept) => {
        dept.members.forEach((m) => {
          if (members.includes(m.toString())) {
            usedMemberIds.add(m.toString());
          }
        });
      });

      const usedUsers = await UserRefrensi.find({
        _id: { $in: Array.from(usedMemberIds) },
      })
        .select("username")
        .lean();

      return res.status(400).json({
        message: "Beberapa member sudah tergabung di department lain",
        usedMembers: usedUsers,
      });
    }

    await Department.create({
      name,
      org: req.user.org,
      members,
    });
    return res.json({ message: "Department berhasil dibuat" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

router.get("/findById/:_id", async (req, res) => {
  const _id = req.params._id;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "ID tidak valid" });
  }

  const department = await Department.findOne({
    _id,
    org: req.user.org,
  }).lean();

  if (!department) {
    return res
      .status(404)
      .json({ message: "Tidak ditemukan department tersebut" });
  }

  return res.json({ data: department });
});

router.get("/list", async (req, res) => {
  try {
    const departments = await Department.find({ org: req.user.org })
      .populate("members", "username role")
      .lean();
    return res.json({
      data: departments,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Gagal, terjadi kesalahan di server" });
  }
});

router.put("/edit/:_id", async (req, res) => {
  const _id = req.params._id;
  const { name, members } = req.body;

  if (!req.user || !req.user.org) {
    return res.status(401).json({ message: "Unauthorized or missing org" });
  }

  try {
    const isExistingDepartment = await Department.findOne({
      _id,
      org: req.user.org,
    });

    if (!isExistingDepartment) {
      return res.status(404).json({ message: "department tidak ditemukan" });
    }

    // validasi semua members apakah valid
    const validMembers = await UserRefrensi.find({
      _id: { $in: members },
    }).lean();
    if (validMembers.length !== members.length) {
      return res
        .status(400)
        .json({ message: "Gagal, beberapa member dipilih tidak valid" });
    }

    // cek apakah ada member yang sudah tergabung di department lain (selain department ini)
    const departmentsWithMembers = await Department.find({
      org: req.user.org,
      _id: { $ne: _id }, // exclude department yang sedang diedit
      members: { $in: members },
    }).lean();

    if (departmentsWithMembers.length > 0) {
      const usedMemberIds = new Set();

      departmentsWithMembers.forEach((dept) => {
        dept.members.forEach((m) => {
          if (members.includes(m.toString())) {
            usedMemberIds.add(m.toString());
          }
        });
      });

      if (usedMemberIds.size > 0) {
        const usedUsers = await UserRefrensi.find({
          _id: { $in: Array.from(usedMemberIds) },
        })
          .select("username")
          .lean();

        return res.status(400).json({
          message: "Beberapa member sudah tergabung di department lain",
          usedMembers: usedUsers,
        });
      }
    }

    // update department
    await Department.updateOne(
      { _id },
      {
        $set: {
          name,
          members,
        },
      }
    );

    return res.json({ message: "Berhasil mengedit" });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "Gagal mengedit: " + error.message });
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    await Department.deleteOne({ _id: req.params.id, org: req.user.org });
    return res.json({ message: "Berhasil menghapus" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Gagal mengahpsu" });
  }
});

export default router;
