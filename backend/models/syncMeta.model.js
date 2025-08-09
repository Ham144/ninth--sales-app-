// models/SyncMeta.js
import mongoose from "mongoose";

const syncMetaSchema = new mongoose.Schema(
  {
    type: {
      type: String, // e.g., "product", "customer"
      required: true,
    },
    lastCompleteSync: Date,
    lastPartialSync: Date,
    completeSyncIntervalHours: {
      type: Number,
      default: 1, // default: setiap 3 hari complete sync (tiap 1 jam partial sync)
    },
  },
  { timestamps: true }
);

const SyncMeta = mongoose.model("SyncMeta", syncMetaSchema);
export default SyncMeta;
