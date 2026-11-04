import assert from "node:assert/strict";
import test from "node:test";
import { createQdrantStore, pointId } from "./qdrantStore.js";

test("pointId stabil per slug dan chunk", () => {
  assert.equal(pointId("howto-retur", 0), pointId("howto-retur", 0));
  assert.notEqual(pointId("howto-retur", 0), pointId("howto-retur", 1));
});

test("createQdrantStore upsert lalu search lewat REST", async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });
    if (String(url).endsWith("/collections/hub_knowledge") && (!opts.method || opts.method === "GET")) {
      return new Response("{}", { status: calls.some((c) => c.method === "PUT" && String(c.url).endsWith("/collections/hub_knowledge")) ? 200 : 404 });
    }
    if (String(url).includes("/points/search")) {
      return new Response(
        JSON.stringify({
          result: [{ score: 0.9, payload: { slug: "howto-retur", title: "Retur", text: "Scan nota", visibility: "public" } }],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ result: true }), { status: 200 });
  };
  const store = createQdrantStore({ url: "http://qdrant.test", fetchImpl });
  await store.upsertDoc({
    slug: "howto-retur",
    title: "Retur",
    visibility: "public",
    chunks: [{ chunkIndex: 0, text: "Scan nota", embedding: [1, 0] }],
  });
  const hits = await store.search({ vector: [1, 0], visibility: "public", limit: 5 });
  assert.equal(hits[0].slug, "howto-retur");
  assert.ok(calls.some((c) => String(c.url).includes("/points?wait=true")));
});
