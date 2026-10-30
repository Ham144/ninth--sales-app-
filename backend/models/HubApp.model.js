import mongoose from "mongoose";

const hubAppSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    url: { type: String, required: true, trim: true },
    iconUrl: { type: String, default: null },
    capabilities: { type: [String], default: [] },
    useCases: { type: [String], default: [] },
    audiences: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    limitations: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    deepLinks: {
      type: [
        {
          label: String,
          url: String,
        },
      ],
      default: [],
    },
    updateAliases: { type: [String], default: [] },
    support: { type: String, default: "" },
    /** false = only "Buka"; true = Login + Sudah login (both open _blank) */
    authRequired: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

hubAppSchema.index({ active: 1, sortOrder: 1, title: 1 });

const HubApp = mongoose.model("HubApp", hubAppSchema);
export default HubApp;
