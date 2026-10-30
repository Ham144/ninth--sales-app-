import "dotenv/config";
import mongoose from "mongoose";
import { EVAL_QUESTIONS, judge } from "./evalQuestions.js";
import { MIDCSI_TENANT_DEFAULT } from "./models/AgentTenant.model.js";
import { runTurn } from "./orchestrator.js";

const only = process.argv[2];
const questions = only ? EVAL_QUESTIONS.filter((question) => question.id === only) : EVAL_QUESTIONS;
if (!questions.length) {
  console.error(`Pertanyaan tidak ada: ${only}`);
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
let failed = 0;
try {
  for (const question of questions) {
    const session = { messages: [] };
    const result = await runTurn({
      tenant: MIDCSI_TENANT_DEFAULT,
      session,
      message: question.message,
    });
    const called = result.toolCallsUsed.map((call) => call.name);
    const payloads = session.messages.filter((message) => message.role === "tool").map((message) => message.content || "");
    const verdict = judge(question, { reply: result.reply, called, payloads });
    const tools = called.join(",") || "-";
    console.log(`${verdict.ok ? "PASS" : "FAIL"} ${question.id} [${tools}] ${verdict.reason}`.trim());
    if (!verdict.ok) {
      console.log(result.reply);
      failed += 1;
    }
  }
} finally {
  await mongoose.disconnect();
}
process.exit(failed ? 1 : 0);
