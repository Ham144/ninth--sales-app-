import mongoose from "mongoose";

//ingat ya username boleh sama,  dia bisa punya beberapa akun gitu yang terdaftar di org yg beda
//jadi bisa ada dua akun csi/yafizham yang punya akun di csi dan ril
//oleh karena itu diperlukan pemilihan tenant (org) untuk setiap login agar ga salah masuk karena username sama
const userSchema = new mongoose.Schema(
  //tetap pakai _id ya untuk link, biar bisa populate
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: String,
    description: String, //dari AD // IT | SMD | SALES_ | SALES
    email: String,
    role: {
      type: String,
      required: true,
      enum: ["member", "viewer", "owner", "supertenant"],
      default: "member",
    },
    password: String, //ini untuk authMethod 'app'
    authMethod: {
      type: String,
      required: true,
      enum: ["app", "ldap"],
      default: "ldap",
    },
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Org",
    },
    refreshToken: String,
    //2fa google authenticator
    _2faSecret: String,
    _2faIsVerified: Boolean,
    //new
    whatsappOtpIsVerified: Boolean,
    phone: {
      //format: 628..
      type: String,
    },
    otp: String, //otp untuk login whatsapp bukan 2fa
    otpExpired: Date,
    otpTried: Number, //maks 5 percobaan
    office: {
      type: String,
    },
  },
  { timestamps: true },
);

const UserRefrensi = new mongoose.model("UserRefrensi", userSchema);
export default UserRefrensi;
