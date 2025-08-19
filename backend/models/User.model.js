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
    },
    displayName: String,
    description: String, //dari AD
    email: String,
    role: {
      type: String,
      required: true,
      enum: ["owner", "member", "supertenant"],
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
  },
  { timestamps: true }
);

const UserRefrensi = new mongoose.model("UserRefrensi", userSchema);
export default UserRefrensi;
