import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createAppToolsRouter } from "./routes/appTools.route.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

test("REST tool MIDCSI butuh service key; petty-cash dan app lain tidak di-proxy Hub", async () => {
  const called = [];
  const app = express();
  app.use(express.json());
  const previous = process.env.AI_SERVICE_KEY;
  process.env.AI_SERVICE_KEY = "test-ai-key";
  app.use(
    "/api/v1/apps",
    createAppToolsRouter({
      getTenant: async () => ({ slug: "csi-agent", tools: undefined }),
      execute: async ({ tool, args }) => {
        called.push({ name: tool.name, args });
        return { payload: { data: [{ No: "CAT-1" }] } };
      },
    }),
  );
  const { server, url } = await listen(app);
  try {
    const denied = await fetch(`${url}/api/v1/apps/midcsi/tools/search_products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ searchKey: "cat" }),
    });
    assert.equal(denied.status, 401);

    const pettyOnHub = await fetch(`${url}/api/v1/apps/petty-cash/tools/petty_cash_warehouses`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-service-key": "test-ai-key" },
      body: JSON.stringify({}),
    });
    const pettyBody = await pettyOnHub.json();
    assert.equal(pettyOnHub.status, 501);
    assert.equal(pettyBody.payload.appId, "petty-cash");

    const pending = await fetch(`${url}/api/v1/apps/catur-pos/tools/list`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-service-key": "test-ai-key" },
      body: JSON.stringify({}),
    });
    const pendingBody = await pending.json();
    assert.equal(pending.status, 501);
    assert.equal(pendingBody.payload.appId, "catur-pos");

    const ok = await fetch(`${url}/api/v1/apps/midcsi/tools/search_products`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-service-key": "test-ai-key" },
      body: JSON.stringify({ searchKey: "cat" }),
    });
    const body = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(body.payload.data[0].No, "CAT-1");
    assert.equal(called[0].name, "search_products");
  } finally {
    server.close();
    if (previous === undefined) delete process.env.AI_SERVICE_KEY;
    else process.env.AI_SERVICE_KEY = previous;
  }
});
