import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    content: { type: String, default: "" },
    context: { type: String, default: "" },
    toolCallId: String,
    toolName: String,
    toolCalls: { type: [mongoose.Schema.Types.Mixed], default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSessionSchema = new mongoose.Schema(
  {
    tenantSlug: { type: String, required: true, index: true },
    visitorId: { type: String, required: true, index: true },
    customerId: { type: String, default: null },
    messages: { type: [messageSchema], default: [] },
    model: { type: String, default: "" },
    modelMode: { type: String, enum: ["fast", "precise"], default: "fast" },
    handoffRequested: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
export default ChatSession;
