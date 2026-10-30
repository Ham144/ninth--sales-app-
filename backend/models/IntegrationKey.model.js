import mongoose from "mongoose";

const IntegrationKeySchema = new mongoose.Schema({
  apiKey: { type: String, required: true, unique: true },
  projectName: { type: String, required: true, unique: true },
  expiredAt: { type: Date }, // optional, for auto-expiry
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  seen: Boolean,
  appSource: { type : String, required: true}, // untuk menandakan input dari frontend mana
  /**
   * full: akses API yang sudah ada (default, key lama).
   * public-catalog: hanya /api/v1/public untuk chatbot B2C. Tidak boleh ke product/SOT.
   */
  scope: {
    type: String,
    enum: ["full", "public-catalog"],
    default: "full",
  },
});

export default mongoose.model("IntegrationKey", IntegrationKeySchema);
