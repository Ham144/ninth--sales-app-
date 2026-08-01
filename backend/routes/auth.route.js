import { Router } from "express";
import generateTokenJWT from "../utils/generateTokenJWT.js";
import UserRefrensi from "../models/User.model.js";
import bcrypt from "bcryptjs";
import LdapClient from "ldapjs-client";
import authenticate from "../middlewares/authenticate.js";
import Org from "../models/Organization.model.js";
import authorize from "../middlewares/authorize.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import jwt from "jsonwebtoken";
import speakEasy from "speakeasy";
import axios from "axios";
import qrcode from "qrcode";
import phoneFormating from "../utils/phoneFormating.js";
import sendWa from "../utils/whatsappUtil.js";

const router = Router();

// Middleware untuk menangani async routes dan error
// Ini akan menangkap Promise rejection dan meneruskannya ke middleware error Express berikutnya
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next); // Meneruskan error ke next()
};

//login LDAP
router.post(
  "/login/ldap",
  asyncHandler(async (req, res) => {
    const {
      username: usernameRaw,
      password,
      selectedOrg,
      captchaToken,
      BYPASS_TURNSTILE_KEY,
      BYPASS_OTP_KEY,
    } = req.body;
    if (!usernameRaw || !password || !selectedOrg) {
      return res.status(400).json({
        success: false,
        message: "perlu melengkapi semua credentials",
      });
    }

    const username = usernameRaw.toLowerCase();

    if (username == "SUPERTENANT") {
      return res.status(400).json({
        success: false,
        message: "tidak boleh nama demikian karena termasuk role spesial",
      });
    }
    const userAgent = req.headers["user-agent"] || "";
    const clientPlatform = req.headers["x-client-platform"] || "";

    // Cek apakah dari Flutter (Dart) atau header custom
    const isMobileClient =
      clientPlatform.toLowerCase() === "mobile" ||
      userAgent.includes("dart:io");

    if (isMobileClient) {
      console.log("Login dari mobile (Flutter)");
    } else {
      console.log("Login dari web atau lainnya");
    }
    //turnstile
    if (
      process.env.NODE_ENV === "production" &&
      !isMobileClient &&
      !BYPASS_TURNSTILE_KEY
    ) {
      try {
        const result = await axios.post(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          new URLSearchParams({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: captchaToken,
            remoteip: req.ip,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        if (!result.data.success) {
          return res
            .status(403)
            .json({ success: false, message: "Verifikasi CAPTCHA gagal." });
        }
        console.log("berhasil verifikasi turnstile");
      } catch (error) {
        console.error("Turnstile error:", error.message);
        return res
          .status(500)
          .json({ success: false, message: "Gagal memverifikasi CAPTCHA." });
      }
    }

    if (BYPASS_TURNSTILE_KEY) {
      if (process.env.BYPASS_TURNSTILE_KEY != BYPASS_TURNSTILE_KEY) {
        return res.status(403).json({
          success: false,
          message: "BYPASS_TURNSTILE_KEY tidak valid.",
        });
      }
    }

    let isOtpBypassValid = false;
    if (BYPASS_OTP_KEY) {
      if (
        !process.env.BYPASS_OTP_KEY ||
        process.env.BYPASS_OTP_KEY !== BYPASS_OTP_KEY
      ) {
        return res.status(403).json({
          success: false,
          message: "BYPASS_OTP_KEY tidak valid.",
        });
      }
      isOtpBypassValid = true;
    }

    const OrgDB = await Org.findById(selectedOrg);
    if (!OrgDB) {
      return res.status(400).json({
        success: false,
        message: "Organisasi yang dipilih tidak ditemukan.",
      });
    }

    if (OrgDB?.isDisabled) {
      return res.status(400).json({
        message:
          "anda tidak bisa login, Organization terkait saat ini dibekukan",
      });
    }

    //LDAP/ AD
    const client = new LdapClient({
      url: `ldap://${OrgDB.AD_HOST}:${OrgDB.AD_PORT}`,
    });

    const bindDn = `${OrgDB.AD_DOMAIN}\\${username}`;
    // const baseDN = "dc=catur,dc=co,dc=id";
    const baseDN = OrgDB.AD_BASE_DN;

    try {
      let userLDAP;
      try {
        // Langkah 1: Bind dulu
        await client.bind(bindDn, password);
        // Langkah 2: Search
        const result = await client.search(baseDN, {
          scope: "sub",
          filter: `(sAMAccountName=${username})`, // ganti dengan user yang kamu tahu
          attributes: [
            "description",
            "displayName",
            "mail",
            "telephoneNumber",
            "physicalDeliveryOfficeName",
          ],
        });
        userLDAP = result[0];
        userLDAP.office = userLDAP.physicalDeliveryOfficeName;
        delete userLDAP.physicalDeliveryOfficeName;
      } catch (error) {
        return res.status(400).json({
          message:
            "Gagal menghubungkan kredensial user ke LDAP, mungkin kesalahan pemmilihan organisasi atau username:password.",
          error,
        });
      }

      //cari apakah user demikian sudah ada
      let userDB = await UserRefrensi.findOne({
        username,
        org: selectedOrg,
        authMethod: "ldap",
      }).select(
        "-password -createdAt -email -otp -refreshToken -role -otpExpired -_2faSecret  -updatedAt -__v",
      );

      if (!userLDAP?.description) {
        return res.status(400).json({
          message:
            "user tidak memiliki description, hubungi IT untuk update description.",
        });
      }

      const isFirstMember = OrgDB?.owners?.length < 2;

      if (!userDB) {
        userDB = new UserRefrensi({
          username,
          org: selectedOrg,
          role: isFirstMember ? "owner" : "member",
          authMethod: "ldap",
          displayName: userLDAP["displayName"],
          email: userLDAP["mail"],
          description: userLDAP["description"],
          office: userLDAP["office"],
        });

        await userDB.save();
        const updateData = {
          $addToSet: {
            members: userDB._id,
          },
        };

        if (isFirstMember) {
          updateData.$addToSet.owners = userDB._id;
        }

        await Org.findByIdAndUpdate(selectedOrg, updateData);
      }

      //jika user sebelumnya memiliki description yg berbeda dengan ldap :ganti
      if (userDB.email !== userLDAP["description"]) {
        await UserRefrensi.findOneAndUpdate(
          { username },
          { $set: { description: userLDAP["description"] } },
        );
      }
      //jika user ada cek apakah email dan physicalDeliveryOfficeName diubah di AD maka update
      if (userDB.email !== userLDAP["mail"]) {
        await UserRefrensi.findOneAndUpdate(
          { username },
          { $set: { email: userLDAP["mail"] } },
        );
      }

      if (userDB.displayName !== userLDAP["displayName"]) {
        await UserRefrensi.findOneAndUpdate(
          { username },
          { $set: { displayName: userLDAP["displayName"] } },
        );
      }

      if (userDB.office !== userLDAP["office"]) {
        await UserRefrensi.findOneAndUpdate(
          { username },
          { $set: { office: userLDAP["office"] } },
        );
      }

      // 2FA pending flow: if user has 2FA enabled, do not issue cookies yet
      if (userDB?._2faIsVerified && !isOtpBypassValid) {
        const pendingToken = jwt.sign(
          {
            _id: userDB._id,
            org: OrgDB._id,
            method: "ldap",
            twoFA: true,
            stage: "pending",
          },
          process.env.JWT_SECRET,
          { expiresIn: "5m" },
        );

        return res.json({
          success: true,
          twoFARequired: true,
          pendingToken,
          message: "2FA verification required",
        });
      }

      // If whatsappOtpIsVerified is enabled for the user, return pending token and skip cookies
      if (userDB?.whatsappOtpIsVerified && userDB?.phone && !isOtpBypassValid) {
        const otp = Math.floor(100000 + Math.random() * 900000);
        const isSuccess = await sendWa({ message: otp, phone: userDB.phone });
        if (isSuccess) {
          userDB.otp = otp;
          userDB.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
          userDB.otpTried = 0;
          await userDB.save();
        } else {
          return res.status(400).json({
            success: false,
            message: "Terjadi kesalahan mengirim OTP ke Whatsapp",
          });
        }
        const pendingToken = jwt.sign(
          {
            _id: userDB._id,
            org: OrgDB._id,
            method: "ldap",
            whatsappOtp: true,
            stage: "pending",
          },
          process.env.JWT_SECRET,
          { expiresIn: "5m" },
        );

        return res.json({
          success: true,
          whatsappOtpIsVerified: true,
          pendingToken,
          message: "Whatsapp OTP verification required",
        });
      }
      const payload = {
        _id: userDB._id,
        username: username,
        org: OrgDB._id,
        role: userDB.role,
        description: userLDAP["description"],
      };

      const myVendor =
        (payload?.description?.startsWith("SALES") &&
          payload?.description.split("_").length) > 1
          ? payload?.description.split("_")[1]
          : null;

      // const access_token =
      //   myVendor === "PHILIPS" ? null : await generateTokenJWT(payload);
      // const refresh_token =
      //   myVendor === "PHILIPS" ? null : await generateRefreshToken(payload);

      const access_token = await generateTokenJWT(payload);
      const refresh_token = await generateRefreshToken(payload);

      // if (myVendor !== "PHILIPS") {
      res.cookie("refresh_token", refresh_token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      userDB.refreshToken = refresh_token;
      // }

      // if (myVendor !== "PHILIPS") {
      res.cookie("access_token", access_token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 5 * 60 * 1000,
      });
      // }

      await userDB.save();

      return res.json({
        success: true,
        message: "Selamat datang kembali.",
        data: payload,
        refresh_token: refresh_token,
        access_token: access_token,
        _2faIsVerified: userDB._2faIsVerified,
        office: userDB.office,
      });
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }),
);

// login app âœ…
router.post("/login/app", async (req, res) => {
  const { username, password, selectedOrg, captchaToken } = req.body;

  if (!username || !password || !selectedOrg) {
    return res.status(400).json({
      success: false,
      message: "Perlu melengkapi semua credentials",
    });
  }
  const userAgent = req.headers["user-agent"] || "";
  const clientPlatform = req.headers["x-client-platform"] || "";

  // Cek apakah dari Flutter (Dart) atau header custom
  const isMobileClient =
    clientPlatform.toLowerCase() === "mobile" || userAgent.includes("dart:io");

  if (isMobileClient) {
    console.log("Login dari mobile (Flutter)");
  } else {
    console.log("Login dari web atau lainnya");
  }
  if (process.env.NODE_ENV == "production" && !isMobileClient) {
    try {
      const result = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: captchaToken,
          remoteip: req.ip,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (!result.data.success) {
        return res
          .status(403)
          .json({ success: false, message: "Verifikasi CAPTCHA gagal." });
      }
      console.log("berhasil verifikasi turnstile");
    } catch (error) {
      console.error("Turnstile error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Gagal memverifikasi CAPTCHA." });
    }
  }

  const OrgDB = await Org.findById(selectedOrg);
  if (!OrgDB) {
    return res.status(400).json({
      success: false,
      message: "Organisasi yang dipilih tidak ditemukan.",
    });
  }

  if (OrgDB?.isDisabled) {
    return res.status(400).json({
      message: "anda tidak bisa login, Organization terkait saat ini dibekukan",
    });
  }

  // Ambil user dengan password (jangan .select dulu!)
  let userDB;
  if (username == "SUPERTENANT") {
    userDB = await UserRefrensi.findOne({
      username,
    });
  } else {
    userDB = await UserRefrensi.findOne({
      username,
      org: selectedOrg,
    });
  }

  if (!userDB) {
    return res.status(400).json({
      success: false,
      message:
        "Anda tidak ditemukan di organisasi ini. Mohon register dulu dan pilih organisasi anda.",
    });
  }

  const isPasswordMatch = await bcrypt.compare(password, userDB.password);
  if (!isPasswordMatch) {
    return res.status(400).json({
      success: false,
      message: "Password salah.",
    });
  }

  if (username == "SUPERTENANT" && OrgDB._id != selectedOrg) {
    await UserRefrensi.findOneAndUpdate(
      { username },
      { $set: { org: OrgDB._id } },
    );
    console.log("org terhubung ke supertenant telah berganti");
  }

  // If 2FA is enabled for the user, return pending token and skip cookies
  if (userDB?._2faIsVerified) {
    const pendingToken = jwt.sign(
      {
        _id: userDB._id,
        org: OrgDB._id,
        method: "app",
        twoFA: true,
        stage: "pending",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    const { password: _pw, ...userWithoutPassword } = userDB.toObject();

    return res.json({
      success: true,
      twoFARequired: true,
      pendingToken,
      data: userWithoutPassword,
      message: "2FA verification required",
    });
  }
  // If whatsappOtpIsVerified is enabled for the user, return pending token and skip cookies
  if (userDB?.whatsappOtpIsVerified && userDB?.phone) {
    const otp = Math.floor(100000 + Math.random() * 900000);
    const isSuccess = await sendWa({ message: otp, phone: userDB.phone });
    if (isSuccess) {
      userDB.otp = otp;
      userDB.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
      userDB.otpTried = 0;
      await userDB.save();
    } else {
      return res.json({
        success: false,
        message: "Terjadi kesalahan mengirim OTP ke Whatsapp",
      });
    }
    const pendingToken = jwt.sign(
      {
        _id: userDB._id,
        org: OrgDB._id,
        method: "app",
        whatsappOtp: true,
        stage: "pending",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    return res.json({
      success: true,
      whatsappOtpIsVerified: true,
      pendingToken,
      message: "Whatsapp OTP verification required",
    });
  }

  const payload = {
    _id: userDB._id,
    username: userDB.username,
    org: OrgDB._id,
    role: userDB.role,
  };

  const accessToken = await generateTokenJWT(payload);
  const refreshToken = await generateRefreshToken(payload);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 5 * 60 * 1000,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  userDB.refreshToken = refreshToken;
  await userDB?.save();

  const { password: _pw, ...userWithoutPassword } = userDB.toObject();

  return res.json({
    success: true,
    message: "Selamat datang kembali.",
    data: userWithoutPassword,
    accessToken,
    refreshToken,
    _2faIsVerified: userDB._2faIsVerified,
  });
});

router.post("/refresh-token", async (req, res) => {
  const refreshToken =
    req.cookies.refresh_token || req.headers.authorization?.split(" ")[1];
  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH);

    // (opsional) cocokan dgn token di database
    const userDB = await UserRefrensi.findById(decoded._id);
    if (!userDB || userDB.refreshToken !== refreshToken)
      return res.status(401).json({
        message:
          "Session Server tidak cocok/telah berganti, silahkan login ulang",
      });

    const OrgDB = await Org.findById(decoded?.org);
    if (!OrgDB) {
      return res.status(400).json({
        success: false,
        message: "Organisasi yang dipilih tidak ditemukan.",
      });
    }

    if (OrgDB?.isDisabled) {
      return res.status(400).json({
        message:
          "anda tidak bisa login, Organization terkait saat ini dibekukan",
      });
    }

    const payload = {
      _id: userDB._id,
      username: userDB.username,
      org: OrgDB._id,
      role: userDB.role,
      description: userDB?.description,
    };

    const accessToken = await generateTokenJWT(payload);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 1 * 60 * 1000, // 1 menit
    });

    // Jangan update refresh token di database, biarkan tetap sama
    // Refresh token akan expire sesuai JWT expiration time
    // Hanya update access token saja

    return res.json({
      message: "Token berhasil diperbarui",
      access_token: accessToken,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(401)
      .json({ message: "Session Anda telah habis, login ulang" });
  }
});

//update user âœ…
router.put(
  "/updateUser",
  authenticate,
  asyncHandler(async (req, res) => {
    const { _id, role, password, email, _2faIsVerified } = req.body;

    if (!_id || !role) {
      return res.status(400).json({
        success: false,
        message: "ID dan role diperlukan.",
      });
    }

    const user = await UserRefrensi.findOne({ _id, org: req.user.org });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
    }

    if (user.role == "supertenant") {
      return res.status(400).json({
        success: false,
        message: "User supertenant masih belum bisa diedit seperti user lain.",
      });
    }

    const orgDB = await Org.findById(req.user.org);
    if (!orgDB) {
      return res.status(404).json({
        success: false,
        message: "Organisasi tidak ditemukan.",
      });
    }

    // Pastikan selalu ada di members[]
    if (!orgDB.members.includes(user._id)) {
      orgDB.members.push(user._id);
    }

    if (email) {
      const duplicateEmail = await UserRefrensi.findOne({
        $and: [
          {
            email,
            org: req.user.org,
          },
          {
            _id: {
              $ne: user._id,
            },
          },
        ],
      });
      if (duplicateEmail) {
        return res.status(400).json({
          message: "duplicate email dalam 1 organisasi, coba email lain",
        });
      }
      user.email = email;
    }

    console.log("_2faIsVerified", _2faIsVerified);
    if (_2faIsVerified !== undefined) {
      const userRaw = await UserRefrensi.findOne({ _id: user._id });
      if (!userRaw._2faSecret && _2faIsVerified === true) {
        return res.status(400).json({
          message:
            "gagal mengaktifkan 2fa user ini, 2fa secret tidak ditemukan",
        });
      }
      user._2faIsVerified = _2faIsVerified ? true : false;
    }

    // Update role dan update array
    if (role === "owner") {
      // Tambahkan ke owners jika belum ada
      if (!orgDB.owners.includes(user._id)) {
        orgDB.owners.push(user._id);
      }
    } else if (role === "member") {
      // Hapus dari owners jika ada
      orgDB.owners = orgDB.owners.filter(
        (ownerId) => ownerId.toString() !== user._id.toString(),
      );
    }

    if (password && user.authMethod === "app") {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;
    }
    user.role = role;

    await orgDB.save();
    await user.save();

    return res.json({
      success: true,
      message: "User berhasil diperbarui.",
    });
  }),
);

router.put("/update/my-profile", authenticate, async (req, res) => {
  const {
    displayName,
    email,
    password,
    oldPassword,
    phone,
    whatsappOtpIsVerified,
  } = req.body;

  let myUser = await UserRefrensi.findById(req.user._id);
  if (displayName) myUser.displayName = displayName;
  if (email) myUser.email = email;
  if (phone) myUser.phone = await phoneFormating(phone);
  if (whatsappOtpIsVerified != null) {
    myUser.whatsappOtpIsVerified = whatsappOtpIsVerified;
  }

  if (password && myUser.authMethod === "app") {
    if (!oldPassword)
      return res.status(400).json({ message: "oldPassword is required." });
    const isMatch = await bcrypt.compare(oldPassword, myUser.password);
    if (!isMatch) return res.status(400).json({ message: "Password salah." });
    const salt = await bcrypt.getSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    myUser.password = hashedPassword;
  }

  await myUser.save();

  return res.json({
    success: true,
    message: "User berhasil diperbarui.",
  });
});

//ini untuk memperbarui userInfo karena di authenticate payload cuma di decode
router.get(
  "/getUserInfo",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Akses tidak sah. Token tidak ditemukan atau tidak valid.",
      });
    }

    let userDB = await UserRefrensi.findOne({
      _id: req.user._id,
      org: req.user.org,
    })
      .select(
        "-password -refreshToken -_2faSecret -otp -createdAt -otpTried -updatedAt -__v",
      )
      .lean();

    if (!userDB) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
    }

    userDB = {
      ...userDB,
    };

    return res.json({
      success: true,
      userInfo: userDB,
    });
  }),
);

//get user info complete âœ…
router.get(
  "/getUserInfoComplete",
  authenticate, // Asumsi middleware authorize akan mengisi req.userId
  asyncHandler(async (req, res) => {
    if (!req.userId) {
      // Sama seperti getUserInfo
      return res.status(401).json({
        success: false,
        message: "Akses tidak sah. Token tidak ditemukan atau tidak valid.",
      });
    }
    const userDB = await UserRefrensi.findOne({
      _id: req.userId,
      org: req.user.org,
    }).select("-password -refreshToken");

    if (!userDB) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
    }
    return res.json({
      success: true,
      message: "Informasi user lengkap berhasil diambil.",
      data: userDB,
    });
  }),
);

//ini memang untuk mengambil semua akun jangan difitler nanti banyak fitur rusak
router.get(
  "/getAllAccount",
  authenticate,
  asyncHandler(async (req, res) => {
    console.log(req.user.org);
    const userDBs = await UserRefrensi.find({
      org: req.user.org,
    }).select("-password -refreshToken -_2faSecret -otp");

    return res.json({
      success: true,
      message: "Semua akun berhasil diambil.",
      data: userDBs,
    });
  }),
);

//ini untuk search akun
router.get(
  "/searchAccount",
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { username } = req.query;
      console.log(username);
      const query = username
        ? {
            username: {
              $regex: username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              $options: "i",
            },
          }
        : {};

      const user = await UserRefrensi.find(query)
        .select("-otpExpired -otp -_2faSecret -password -refreshToken")
        .sort({ createdAt: -1 })
        .limit(5);

      return res.json(user);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }),
);

//ini untuk membuat user yang tidak terikat dengan LDAP
router.post("/createAppUser", authenticate, async (req, res) => {
  const { username, email, password, role } = req.body;

  // Validasi input awal
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username, email, dan password harus diisi.",
    });
  }

  try {
    // Cek duplikasi username di organisasi yang sama
    const usernameExists = await UserRefrensi.findOne({
      username,
      org: req.user.org,
    });
    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: "Username sudah digunakan.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user baru
    await UserRefrensi.create({
      username,
      email,
      password: hashedPassword,
      role: role || "member",
      authMethod: "app",
      org: req.user.org,
    });

    return res.status(201).json({
      success: true,
      message: "User berhasil dibuat.",
    });
  } catch (error) {
    console.error(" Create App User Error:", error);
    return res.status(500).json({
      success: false,
      message: JSON.stringify(error.message),
    });
  }
});

//take over old user dengan menggantinya dengan data dari newuser dan mengahapus new user
router.put("/takeOverUser", authenticate, authorize, async (req, res) => {
  const { oldUser, newUser } = req.body; // oldUser dan newUser seharusnya adalah _id string

  if (oldUser == newUser) {
    return res.status(400).json({
      message: "User target dan user takeover tidak boleh sama.",
    });
  }

  try {
    // 1. Validasi Input
    if (!oldUser || !newUser) {
      return res.status(400).json({
        message: "Bad Request: 'oldUser' dan 'newUser' ID harus disediakan.",
      });
    }

    // 2. Temukan Dokumen User
    // Pastikan _id adalah ObjectId yang valid, jika tidak, findOne akan gagal atau mengembalikan null
    const [newUserDoc, oldUserDoc] = await Promise.all([
      UserRefrensi.findOne({ _id: newUser, org: req.user.org }),
      UserRefrensi.findOne({ _id: oldUser, org: req.user.org }),
    ]);

    if (!newUserDoc || !oldUserDoc) {
      return res.status(404).json({
        message: "User baru atau user lama tidak ditemukan di database.",
      });
    }

    // Hindari menyalin _id atau __v, dan pastikan field yang disalin adalah yang benar-benar diinginkan
    // Gunakan set() untuk mengupdate field secara selektif
    oldUserDoc.username = newUserDoc?.username;
    oldUserDoc.email = newUserDoc?.email;
    oldUserDoc.password = newUserDoc?.password; // Hati-hati dengan ini, pastikan Anda menyalin hash password, bukan plain text
    oldUserDoc.role = newUserDoc?.role;
    oldUserDoc.authMethod = newUserDoc?.authMethod;

    // Opsional: Reset status user lama menjadi aktif kembali
    oldUserDoc.isActive = true; // Atau set status ke 'active'
    oldUserDoc.resignedAt = null; // Jika ada field ini, reset juga

    // Anda mungkin juga ingin menyalin field lain seperti:
    // oldUserDoc.ldapUsername = newUserDoc.ldapUsername;
    // oldUserDoc.profilePicture = newUserDoc.profilePicture;
    // ...dll.

    // 5. Simpan Perubahan ke User Lama
    await oldUserDoc.save();

    // 6. Hapus User Baru
    await UserRefrensi.deleteOne({
      // Gunakan deleteOne, bukan findOneAndDelete jika Anda sudah punya _id
      _id: newUserDoc._id, // Gunakan _id dari dokumen yang sudah ditemukan
      org: req.user.org,
    });

    // 7. Berikan Respon Sukses
    return res.status(200).json({
      message: `Berhasil take over user. Akun ${oldUserDoc.username} (sebelumnya ${newUserDoc.username}) kini telah diwarisi.`,
    });
  } catch (error) {
    console.error("Error during user takeover:", error); // Gunakan console.error untuk log error
    // Tangani error Mongoose spesifik, misalnya CastError untuk _id yang tidak valid
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Bad Request: Format ID user tidak valid.",
      });
    }
    return res.status(500).json({
      message: "Terjadi kesalahan internal server saat mengambil alih user.",
      error: error.message, // Sertakan pesan error untuk debugging di lingkungan dev
    });
  }
});

//----2fa authenticator endpoints START------

//to generate the and activate the feature
router.get("/2fa/activate", authenticate, async (req, res) => {
  try {
    const user = await UserRefrensi.findOne({
      org: req.user.org,
      _id: req.user._id,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    //check if the user is actually have enabled the feature
    if (user?._2faIsVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Your 2fa authenticator feature is enabled before, you can't enable it again otherwise the secret.base32 will be change",
      });
    }

    //main
    const secret = speakEasy.generateSecret({
      name: "Sales Order App",
      length: 20,
    });

    //add to userDB
    user._2faIsVerified = false;
    user._2faSecret = secret.base32;

    //generate qr
    qrcode.toDataURL(secret.otpauth_url, async (err, url) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err?.message,
        });
      } else {
        await user.save();
        return res.json({
          success: true,
          message: "2fa authenticator Qr code is generated",
          data: {
            qrCode: url,
          },
        });
      }
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

//to disable the 2fa authenticator feature
router.delete("/2fa/deactivate", authenticate, async (req, res) => {
  try {
    const user = await UserRefrensi.findOne({
      org: req.user.org,
      _id: req.user._id,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user?._2faIsVerified) {
      return res.status(400).json({
        success: false,
        message: "2fa is not enabled yet",
      });
    } else {
      user._2faIsVerified = false;
      user._2faSecret = "";

      await user.save();
      return res.json({
        success: true,
        message: "2fa authenticator is disabled successfully",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

//to check is user has 2fa ?
router.get("/2fa/status", authenticate, async (req, res) => {
  try {
    const user = await UserRefrensi.findOne({
      org: req.user.org,
      _id: req.user._id,
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user?._2faIsVerified) {
      return res.status(400).json({
        success: false,
        message: "2fa is not verified yet",
      });
    } else {
      return res.json({
        success: true,
        message: "2fa is already activated",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error?.message,
    });
  }
});

//confirmation of 2fa activation not for the login check
router.post("/2fa/verify", authenticate, async (req, res) => {
  const { otp: token } = req.body;

  try {
    const user = await UserRefrensi.findOne({
      _id: req.user._id,
      org: req.user.org,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const _2faSecret = user?._2faSecret;
    if (!_2faSecret) {
      return res.status(400).json({
        success: false,
        message: "2fa authenticator app is not configured yet",
      });
    }

    //main
    const isMatched = speakEasy.totp.verify({
      token,
      window: 1,
      secret: _2faSecret,
      encoding: "base32",
    });

    if (isMatched) {
      user._2faIsVerified = true;

      await user.save();

      return res.json({
        success: true,
        message: "2fa Authenticator is configured and enabled successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "the token is not matched, please try again",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: error?.message,
    });
  }
});

//whatsapp otp init
router.get("/whatsapp-otp/test", authenticate, async (req, res) => {
  try {
    const user = await UserRefrensi.findOne({
      _id: req.user._id,
      org: req.user.org,
    });

    if (!user?.whatsappOtpIsVerified && user?.phone) {
      //buat otp 6 digit
      const otp = Math.floor(100000 + Math.random() * 900000);
      const isSuccess = await sendWa({ message: otp, phone: user.phone });
      if (isSuccess) {
        user.otp = otp;
        user.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
        user.otpTried = 0;
        await user.save();
        return res.json({ success: true, message: "success" });
      } else {
        return res.json({ success: false, message: "failed" });
      }
    }
    return res
      .status(400)
      .json({ success: false, message: "user harus memiliki nomor whatsapp" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error?.message });
  }
});

//confirmation of whatsapp  OTP layer 3 activation not for the login check
router.post("/whatsapp-otp/verify", authenticate, async (req, res) => {
  const { otp } = req.body;

  if (!otp)
    return res.status(400).json({
      success: false,
      message: "otp is required",
    });
  try {
    const user = await UserRefrensi.findOne({
      _id: req.user._id,
      org: req.user.org,
    });

    if (!user.otp) {
      return res.status(400).json({
        success: false,
        message: "otp belum ditetapkan",
      });
    }

    const isMatched = otp === user.otp;
    if (isMatched) {
      user.whatsappOtpIsVerified = true;
      user.otp = "";
      user.otpTried = 0;
      user.otpExpiresAt = null;

      await user.save();

      return res.json({
        success: true,
        message: "whatsapp Otp Is Verified and enabled successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "OTP salah",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: error?.message,
    });
  }
});

// complete 2FA login: verify OTP against user's secret and then issue cookies
router.post("/2fa/login-complete", async (req, res) => {
  const { otp, pendingToken } = req.body;

  if (!otp || !pendingToken) {
    return res.status(400).json({
      success: false,
      message: "otp and pendingToken are required",
    });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired pending token" });
    }

    if (!decoded?.twoFA || decoded?.stage !== "pending") {
      return res.status(400).json({ message: "Invalid pending token stage" });
    }

    const user = await UserRefrensi.findOne({
      _id: decoded._id,
      org: decoded.org,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user?._2faIsVerified || !user?._2faSecret) {
      return res
        .status(400)
        .json({ success: false, message: "2FA not configured" });
    }

    const isMatched = speakEasy.totp.verify({
      token: otp,
      window: 1,
      secret: user._2faSecret,
      encoding: "base32",
    });

    if (!isMatched) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    //stop disini jika ada layer 3 (whatsapp OTP)
    if (user?.whatsappOtpIsVerified && user?.phone) {
      const otp = Math.floor(100000 + Math.random() * 900000);
      const isSuccess = await sendWa({ message: otp, phone: user.phone });
      if (isSuccess) {
        user.otp = otp;
        user.otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
        user.otpTried = 0;
        console.log(user);
        await user.save();
      } else {
        return res.status(400).json({
          success: false,
          message: "Terjadi kesalahan mengirim OTP ke Whatsapp",
        });
      }
      const pendingToken = jwt.sign(
        {
          _id: decoded._id,
          org: decoded.org,
          method: "app",
          whatsappOtp: true,
          stage: "pending",
        },
        process.env.JWT_SECRET,
        { expiresIn: "5m" },
      );

      return res.json({
        success: true,
        whatsappOtpIsVerified: true,
        pendingToken,
        message: "Whatsapp OTP verification required",
      });
    }

    const OrgDB = await Org.findById(decoded.org);
    if (!OrgDB) {
      return res
        .status(400)
        .json({ success: false, message: "Organization not found" });
    }
    if (OrgDB?.isDisabled) {
      return res.status(400).json({
        message:
          "anda tidak bisa login, Organization terkait saat ini dibekukan",
      });
    }

    const payload = {
      _id: user._id,
      username: user.username,
      org: OrgDB._id,
      role: user.role,
      description: user?.description,
    };

    const accessToken = await generateTokenJWT(payload);
    const refreshToken = await generateRefreshToken(payload);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 5 * 60 * 1000,
    });

    user.refreshToken = refreshToken;
    await user.save();

    return res.json({
      success: true,
      refresh_token: refreshToken,
      access_token: accessToken,
      message: "Login completed with 2FA",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error?.message });
  }
});

// complete whatsapp OTP login layer
router.post("/whatsapp-otp/login-complete", async (req, res) => {
  const { otp, pendingToken } = req.body;

  if (!otp || !pendingToken) {
    return res.status(400).json({
      success: false,
      message: "otp and pendingToken are required",
    });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired pending token" });
    }

    if (!decoded?.whatsappOtp || decoded?.stage !== "pending") {
      return res.status(400).json({ message: "Invalid pending token stage" });
    }

    const user = await UserRefrensi.findOne({
      _id: decoded._id,
      org: decoded.org,
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const isMatched = user.otp === otp;

    if (!isMatched) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const OrgDB = await Org.findById(decoded.org);
    if (!OrgDB) {
      return res
        .status(400)
        .json({ success: false, message: "Organization not found" });
    }
    if (OrgDB?.isDisabled) {
      return res.status(400).json({
        message:
          "anda tidak bisa login, Organization terkait saat ini dibekukan",
      });
    }

    const payload = {
      _id: user._id,
      username: user.username,
      org: OrgDB._id,
      role: user.role,
      description: user?.description,
    };

    const accessToken = await generateTokenJWT(payload);
    const refreshToken = await generateRefreshToken(payload);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 5 * 60 * 1000,
    });

    user.refreshToken = refreshToken;
    //reset
    user.whatsappOtpIsVerified = true;
    user.otp = "";
    user.otpTried = 0;
    user.otpExpired = null;

    await user.save();

    return res.json({
      success: true,
      refresh_token: refreshToken,
      access_token: accessToken,
      message: "Login completed with Whatsppap OTP",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message });
  }
});

//----2fa authenticator endpoints END------

router.delete(
  "/revokeSession/:id",
  authenticate,
  authorize,
  async (req, res) => {
    const id = req?.params?.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Id is required",
      });
    }

    await UserRefrensi.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          refreshToken: null,
        },
      },
    );

    return res.json({
      message: "User akan segera logout.",
    });
  },
);

router.delete("/deleteAppUser/:id", authenticate, async (req, res) => {
  const id = req?.params?.id;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Id is required",
    });
  }

  try {
    await UserRefrensi.findOneAndDelete({ _id: id });

    return res.json({
      message: "User berhasil dihapus.",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
});

// web
router.delete(
  "/logout",
  asyncHandler(async (req, res) => {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });

    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    }); // Pastikan opsi cookie sama saat menghapus
    return res.json({
      success: true,
      refresh_token: "",
      access_token: "",
      message: "Berhasil logout.",
    });
  }),
);

export default router;
