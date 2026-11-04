import mongoose from "mongoose";

/**
 * Knowledge corpus for System Hub docs.
 * RAG-ready: keep `content` as the canonical text; optional `chunks` + `embedding`
 * can be filled later without changing the public API shape.
 */
const chunkSchema = new mongoose.Schema(
  {
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    tokenEstimate: { type: Number, default: 0 },
    /** filled later by embedding job — excluded from default queries */
    embedding: { type: [Number], select: false, default: undefined },
  },
  { _id: false },
);

const hubKnowledgeDocSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      enum: ["howto", "technical"],
      required: true,
      index: true,
    },
    /**
     * public: boleh dipakai chatbot pengunjung e-commerce.
     * internal: dokumentasi teknikal (x-api-key, voucher, diskon, POS, gudang).
     * Dokumen lama tanpa field ini diperlakukan internal jika docType technical.
     */
    visibility: {
      type: String,
      enum: ["public", "internal"],
      default: "internal",
      index: true,
    },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    appId: { type: String, default: null },
    appTitle: { type: String, default: null, index: true },
    stage: { type: String, default: null },
    appUrl: { type: String, default: null },
    summary: { type: String, default: "" },
    /** Optional hero/cover image URL for blog-style listing */
    coverImage: { type: String, default: null },
    /** Full markdown/plain body used by humans and as RAG source of truth */
    content: { type: String, required: true },
    tags: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    features: {
      type: [
        {
          name: String,
          description: String,
        },
      ],
      default: [],
    },
    source: { type: String, default: "system-hub" },
    searchText: { type: String, default: "" },
    hasEmbeddings: { type: Boolean, default: false, index: true },
    embeddingModel: { type: String, default: null },
    contentHash: { type: String, default: null },
    chunks: { type: [chunkSchema], default: [] },
  },
  { timestamps: true },
);

hubKnowledgeDocSchema.index({
  title: "text",
  summary: "text",
  content: "text",
  searchText: "text",
  tags: "text",
});

hubKnowledgeDocSchema.pre("validate", function buildSearchText(next) {
  const featureText = (this.features || [])
    .map((f) => `${f.name || ""} ${f.description || ""}`)
    .join(" ");
  this.searchText = [
    this.title,
    this.appTitle,
    this.summary,
    this.content,
    featureText,
    ...(this.tags || []),
    ...(this.technologies || []),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  next();
});

const HubKnowledgeDoc = mongoose.model("HubKnowledgeDoc", hubKnowledgeDocSchema);
export default HubKnowledgeDoc;
