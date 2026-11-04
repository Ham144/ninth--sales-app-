import assert from "node:assert/strict";
import test from "node:test";
import { applyChatDelta, completeChat, emptyStreamState, streamChat } from "./llm.js";

test("applyChatDelta merangkai token dan tidak menampilkan teks saat tool call", () => {
  const text = emptyStreamState("m");
  assert.equal(applyChatDelta(text, { choices: [{ delta: { content: "Halo " } }] }), "Halo ");
  assert.equal(applyChatDelta(text, { choices: [{ delta: { content: "staf" } }] }), "staf");
  assert.equal(text.content, "Halo staf");
  assert.equal(text.mode, "content");

  const tools = emptyStreamState("m");
  applyChatDelta(tools, {
    choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "search", arguments: "{" } }] } }],
  });
  assert.equal(applyChatDelta(tools, { choices: [{ delta: { content: "abaikan" } }] }), "");
  assert.equal(tools.mode, "tools");
  assert.equal(tools.toolCalls[0].function.name, "search");
});

test("streamChat meneruskan token saat SSE datang", async () => {
  const pieces = [];
  const sse = [
    'data: {"choices":[{"delta":{"content":"Halo "}}]}',
    'data: {"choices":[{"delta":{"content":"dunia"}}]}',
    "data: [DONE]",
    "",
  ].join("\n\n");
  const result = await streamChat({
    baseUrl: "https://llm.test/v1",
    apiKey: "k",
    model: "m",
    messages: [],
    onToken: (text) => pieces.push(text),
    fetchImpl: async () =>
      new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }),
  });
  assert.deepEqual(pieces, ["Halo ", "dunia"]);
  assert.equal(result.content, "Halo dunia");
  assert.equal(result.toolCalls.length, 0);
});

test("completeChat tanpa onToken tetap memakai JSON", async () => {
  const result = await completeChat({
    baseUrl: "https://llm.test/v1",
    apiKey: "k",
    model: "m",
    messages: [],
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.stream, undefined);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "siap", tool_calls: [] } }],
          usage: { total_tokens: 3 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(result.content, "siap");
});
