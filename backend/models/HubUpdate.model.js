import mongoose from "mongoose";

const hubUpdateSchema = new mongoose.Schema(
  {
    projectSlug: { type: String, default: "" },
    projectTitle: { type: String, required: true, index: true },
    projectMatched: { type: Boolean, default: true },
    task: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "done", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, default: null },
    /** Flattened text for search / future RAG retrieval over changelog */
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

hubUpdateSchema.index({ searchText: "text", task: "text", projectTitle: "text" });

hubUpdateSchema.pre("validate", function buildSearchText(next) {
  this.searchText = [
    this.projectTitle,
    this.projectSlug,
    this.task,
    this.status,
    this.completedBy,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  next();
});

const HubUpdate = mongoose.model("HubUpdate", hubUpdateSchema);
export default HubUpdate;
