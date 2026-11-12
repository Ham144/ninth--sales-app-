import { Router } from "express";
import { MIDCSI_TOOLS, REQUEST_HUMAN, activeTools, executeTool } from "../tools.js";
import AgentTenant, { MIDCSI_TENANT_DEFAULT } from "../models/AgentTenant.model.js";

const MIDCSI_IDS = new Set(["midcsi", "midcsi-so"]);

function requireServiceKey(req, res, next) {
  const expected = process.env.AI_SERVICE_KEY || "";
  if (!expected || req.headers["x-ai-service-key"] !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

export function createAppToolsRouter(deps = {}) {
  const router = Router();
  const execute = deps.execute || executeTool;
  const getTenant = deps.getTenant || (async () => {
    const existing = await AgentTenant.findOne({ slug: "csi-agent" }).lean();
    return existing || MIDCSI_TENANT_DEFAULT;
  });

  router.get("/:appId/tools", requireServiceKey, async (req, res) => {
    const { appId } = req.params;
    if (!MIDCSI_IDS.has(appId)) {
      return res.status(501).json({
        error: "App belum mendaftarkan REST tool",
        appId,
      });
    }
    const names = [REQUEST_HUMAN, ...MIDCSI_TOOLS].map((tool) => tool.name);
    return res.json({ appId: "midcsi", tools: names });
  });

  router.post("/:appId/tools/:name", requireServiceKey, async (req, res) => {
    const { appId, name } = req.params;
    if (!MIDCSI_IDS.has(appId)) {
      return res.status(501).json({
        payload: {
          error: "App belum mendaftarkan REST tool di Hub. petty-cash dilayani Nest, bukan path ini.",
          appId,
        },
      });
    }
    try {
      const tenant = await getTenant();
      const customerId = req.body?.customerId || req.body?.customer_id || undefined;
      const args = req.body?.args && typeof req.body.args === "object" ? req.body.args : req.body || {};
      const clean = { ...args };
      delete clean.customerId;
      delete clean.customer_id;
      const tool = activeTools(tenant, customerId).find((item) => item.name === name);
      if (!tool) {
        return res.status(404).json({ payload: { error: "Tool tidak dikenal", name } });
      }
      const result = await execute({
        tool,
        args: clean,
        customerId,
        fetchImpl: deps.fetchImpl || globalThis.fetch,
        upstream: tenant.upstream,
        limiter: deps.limiter,
      });
      return res.json({ payload: result.payload, handoff: Boolean(result.handoff) });
    } catch {
      return res.status(500).json({ payload: { error: "data tidak tersedia" } });
    }
  });

  return router;
}
