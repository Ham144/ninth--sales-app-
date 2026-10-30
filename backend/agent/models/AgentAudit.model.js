import mongoose from "mongoose";

const agentAuditSchema = new mongoose.Schema(
  {
    tenantSlug: String,
    visitorId: String,
    sessionId: String,
    toolName: String,
    args: mongoose.Schema.Types.Mixed,
    latencyMs: Number,
    tokens: Number,
    modelMode: String,
    model: String,
  },
  { timestamps: true },
);

const AgentAudit = mongoose.model("AgentAudit", agentAuditSchema);
export default AgentAudit;
