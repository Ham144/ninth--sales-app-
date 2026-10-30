import mongoose from "mongoose";
import { MIDCSI_TOOLS } from "../tools.js";

const toolSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    kind: { type: String, default: "internal" },
    internal: String,
    method: String,
    path: String,
    tier: { type: String, default: "anonymous" },
    enabled: { type: Boolean, default: true },
    cacheTtlSeconds: Number,
    parameters: { type: mongoose.Schema.Types.Mixed },
    responseAllowlist: [String],
    inject: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const agentTenantSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    audience: { type: String, enum: ["internal", "public"], default: "internal" },
    dataSensitivity: { type: String, enum: ["public", "sensitive"], default: "public" },
    allowedOrigins: { type: [String], default: [] },
    systemPrompt: { type: String, default: "" },
    llm: {
      baseUrl: { type: String, default: "" },
      apiKey: { type: String, default: "" },
      model: { type: String, default: "" },
      fallbackModel: { type: String, default: "" },
    },
    llmModes: {
      precise: {
        baseUrl: { type: String, default: "" },
        apiKey: { type: String, default: "" },
        model: { type: String, default: "" },
        fallbackModel: { type: String, default: "" },
      },
    },
    upstream: {
      baseUrl: { type: String, default: "" },
      apiKey: { type: String, default: "" },
    },
    tools: { type: [toolSchema], default: undefined },
    dailyTokenBudget: { type: Number, default: 200000 },
    rateLimit: {
      perIpPerMinute: { type: Number, default: 20 },
      perVisitorPerMinute: { type: Number, default: 12 },
      perTenantPerMinute: { type: Number, default: 120 },
    },
    memoryWindowSize: { type: Number, default: 12 },
    maxToolIterations: { type: Number, default: 4 },
    handoffWebhookUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export const MIDCSI_TENANT_DEFAULT = {
  slug: "midcsi",
  name: "MIDCSI Hub",
  status: "active",
  audience: "internal",
  dataSensitivity: "public",
  allowedOrigins: [],
  tools: MIDCSI_TOOLS,
  dailyTokenBudget: 200000,
};

const AgentTenant = mongoose.model("AgentTenant", agentTenantSchema);
export default AgentTenant;
