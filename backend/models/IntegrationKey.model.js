import mongoose from "mongoose";

const IntegrationKeySchema = new mongoose.Schema({
  apiKey: { type: String, required: true, unique: true },
  projectName: { type: String, required: true, unique: true },
  expiredAt: { type: Date }, // optional, for auto-expiry
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  seen: Boolean,
});


export default mongoose.model("IntegrationKey", IntegrationKeySchema);
