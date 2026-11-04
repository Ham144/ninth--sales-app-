import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import IntegrationKeyModel from "../../models/IntegrationKey.model.js";
import authenticate from "../../middlewares/authenticate.js";
import requireIT from "../../middlewares/requireIT.js";
import AgentAudit from "../models/AgentAudit.model.js";
import AgentTenant, { MIDCSI_TENANT_DEFAULT } from "../models/AgentTenant.model.js";
import ChatSession from "../models/ChatSession.model.js";
import { availableModelModes, effectiveLlm, normalizeModelMode, resolveLlm } from "../llm.js";
import { runTurn } from "../orchestrator.js";
import { openApi } from "../openapi.js";

const TTL_SECONDS = Number(process.env.CHAT_TOKEN_TTL_SECONDS) || 900;

export function originError(tenant, origin, nodeEnv) {
  const allowed = tenant?.allowedOrigins || [];
  if (!allowed.length) {
    return nodeEnv === "production" ? "Origin belum dikonfigurasi untuk agent" : null;
  }
  if (!origin) return nodeEnv === "production" ? "Origin wajib" : null;
  if (!allowed.includes(origin)) return "Origin tidak diizinkan";
  return null;
}

function signChatToken({ visitorId, customerId, canSelectModel = false, secret, ttl }) {
  return jwt.sign(
    {
      purpose: "agent-chat",
      sub: visitorId,
      slug: "midcsi",
      cid: customerId || undefined,
      modelSelect: Boolean(canSelectModel),
    },
    secret,
    { expiresIn: ttl },
  );
}

function verifyChatToken(token, secret) {
  const payload = jwt.verify(token, secret);
  if (payload?.purpose !== "agent-chat") {
    const error = new Error("Token bukan chat token");
    error.status = 401;
    throw error;
  }
  return payload;
}

function mongoStore() {
  return {
    async getTenant() {
      const existing = await AgentTenant.findOne({ slug: "midcsi" }).lean();
      if (existing) {
        const catalog = MIDCSI_TENANT_DEFAULT.tools;
        const previous = new Map((existing.tools || []).map((tool) => [tool.name, tool]));
        const tools = catalog.map((tool) => {
          const saved = previous.get(tool.name);
          return saved ? { ...tool, enabled: saved.enabled !== false } : tool;
        });
        const removedTools = new Set(["top_overdue", "recent_orders", "sales_order_status"]);
        const extras = (existing.tools || []).filter(
          (tool) => !removedTools.has(tool.name) && !catalog.some((item) => item.name === tool.name),
        );
        const aligned = [...tools, ...extras];
        const patch = {};
        if (!existing.audience) {
          patch.audience = "internal";
          existing.audience = "internal";
        }
        if (JSON.stringify(existing.tools || []) !== JSON.stringify(aligned)) {
          patch.tools = aligned;
          existing.tools = aligned;
        }
        if (Object.keys(patch).length) {
          await AgentTenant.updateOne({ slug: "midcsi" }, { $set: patch });
        }
        return existing;
      }
      try {
        return (await AgentTenant.create(MIDCSI_TENANT_DEFAULT)).toObject();
      } catch (error) {
        if (error?.code === 11000) {
          return AgentTenant.findOne({ slug: "midcsi" }).lean();
        }
        throw error;
      }
    },
    async saveTenant(patch) {
      const { _id, __v, createdAt, updatedAt, ...rest } = patch;
      return AgentTenant.findOneAndUpdate({ slug: "midcsi" }, rest, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }).lean();
    },
    async saveSession(session) {
      if (session._id) {
        const { _id, ...rest } = session;
        return ChatSession.findByIdAndUpdate(_id, rest, { new: true }).lean();
      }
      return (await ChatSession.create(session)).toObject();
    },
    async findSession(id, visitorId) {
      if (!mongoose.isValidObjectId(id)) return null;
      return ChatSession.findOne({ _id: id, visitorId }).lean();
    },
    async listSessions(visitorId, limit = 40) {
      return ChatSession.find({ visitorId, tenantSlug: "midcsi" })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select({ updatedAt: 1, messages: { $slice: 8 } })
        .lean();
    },
    async addAudit(entry) {
      await AgentAudit.create(entry);
    },
    async findApiKey(raw) {
      return IntegrationKeyModel.findOne({ apiKey: raw }).lean();
    },
  };
}

function redactTenant(tenant) {
  if (!tenant) return null;
  return {
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    dataSensitivity: tenant.dataSensitivity,
    allowedOrigins: tenant.allowedOrigins || [],
    systemPrompt: tenant.systemPrompt || "",
    dailyTokenBudget: tenant.dailyTokenBudget,
    handoffWebhookUrl: tenant.handoffWebhookUrl || "",
    llm: {
      baseUrl: tenant.llm?.baseUrl || "",
      model: tenant.llm?.model || "",
      fallbackModel: tenant.llm?.fallbackModel || "",
      hasApiKey: Boolean(tenant.llm?.apiKey),
    },
    llmModes: {
      precise: {
        baseUrl: tenant.llmModes?.precise?.baseUrl || "",
        model: tenant.llmModes?.precise?.model || "",
        fallbackModel: tenant.llmModes?.precise?.fallbackModel || "",
        hasApiKey: Boolean(tenant.llmModes?.precise?.apiKey),
      },
    },
    tools: (tenant.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      tier: tool.tier,
      enabled: tool.enabled !== false,
    })),
  };
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === "function") res.flush();
}

function hasUserMessage(session) {
  return (session?.messages || []).some((item) => item.role === "user" && String(item.content || "").trim());
}

function sessionTitle(session) {
  const first = (session?.messages || []).find((item) => item.role === "user" && item.content);
  const text = String(first?.content || "Percakapan baru").replace(/\s+/g, " ").trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (process.env.TRUST_PROXY === "1" && forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.ip || "unknown";
}

async function enforceLimits(limiter, tenant, { ip, visitorId }) {
  const limits = tenant.rateLimit || {};
  const checks = [
    [`agent:ip:${ip}`, limits.perIpPerMinute || 20],
    [`agent:visitor:${visitorId}`, limits.perVisitorPerMinute || 12],
    [`agent:tenant:${tenant.slug}`, limits.perTenantPerMinute || 120],
  ];
  for (const [key, limit] of checks) {
    const result = await limiter.take(key, limit, 60);
    if (!result.ok) return false;
  }
  return true;
}

export function createAgentRouter(deps = {}) {
  const router = Router();
  const store = deps.store || mongoStore();
  const limiter = deps.limiter;
  const nodeEnv = deps.nodeEnv || process.env.NODE_ENV || "development";
  const secret = deps.jwtSecret || process.env.JWT_SECRET || "";
  const fetchImpl = deps.fetchImpl || globalThis.fetch;

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "csi-agent" });
  });

  router.get("/openapi.json", (_req, res) => {
    res.json(openApi);
  });

  router.post("/token", async (req, res) => {
    try {
      const raw = req.headers["x-api-key"];
      if (!raw) return res.status(401).json({ message: "Missing x-api-key header" });
      const apiKey = await store.findApiKey(raw);
      const expired =
        apiKey?.expiredAt && new Date(apiKey.expiredAt).getTime() < Date.now();
      if (!apiKey || apiKey.status === "revoked" || expired) {
        return res.status(401).json({ message: "Api key sudah tidak valid" });
      }
      const visitorId = String(req.body?.visitorId || "").trim();
      if (!visitorId || visitorId.length > 120) {
        return res.status(400).json({ message: "visitorId wajib" });
      }
      if (!secret) return res.status(503).json({ message: "JWT_SECRET belum diisi" });
      const customerId = req.body?.customerId
        ? String(req.body.customerId).slice(0, 80)
        : undefined;
      const chatToken = signChatToken({
        visitorId,
        customerId,
        secret,
        ttl: TTL_SECONDS,
      });
      return res.json({ chatToken, expiresIn: TTL_SECONDS, tokenType: "Bearer" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post("/demo/token", authenticate, async (req, res) => {
    try {
      if (!secret) return res.status(503).json({ message: "JWT_SECRET belum diisi" });
      const visitorId = `hub-${req.user?.username || req.user?._id || "demo"}`;
      const chatToken = signChatToken({
        visitorId,
        canSelectModel: req.user?.description === "IT",
        secret,
        ttl: TTL_SECONDS,
      });
      return res.json({ chatToken, expiresIn: TTL_SECONDS, tokenType: "Bearer" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  async function readChat(req, res, next) {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token || !secret) return res.status(401).json({ message: "Chat token wajib" });
      const payload = verifyChatToken(token, secret);
      const tenant = await store.getTenant();
      if (!tenant || tenant.status === "revoked") {
        return res.status(403).json({ message: "Agent tidak aktif" });
      }
      const blocked = originError(tenant, req.headers.origin, nodeEnv);
      if (blocked) return res.status(403).json({ message: blocked });
      req.chat = {
        tenant,
        visitorId: payload.sub,
        customerId: payload.cid || null,
        canSelectModel: payload.modelSelect === true,
      };
      next();
    } catch {
      return res.status(401).json({ message: "Chat token tidak valid" });
    }
  }

  function chosenModelMode(requested, canSelectModel, tenant) {
    const mode = normalizeModelMode(requested || "pas");
    if (mode !== "pas" && !canSelectModel) {
      const error = new Error("Level model hanya untuk IT");
      error.status = 403;
      throw error;
    }
    const selected = canSelectModel ? mode : "pas";
    const catalog = availableModelModes(tenant, deps.env || process.env).find((item) => item.id === selected);
    if (!catalog?.available) {
      const error = new Error("Level model belum dikonfigurasi");
      error.status = 409;
      throw error;
    }
    return selected;
  }

  router.get("/model-modes", readChat, async (req, res) => {
    const modes = availableModelModes(req.chat.tenant, deps.env || process.env);
    return res.json({
      modes: req.chat.canSelectModel ? modes : modes.filter((mode) => mode.id === "pas"),
      canSelect: req.chat.canSelectModel,
    });
  });

  router.post("/chat", readChat, async (req, res) => {
    const { tenant, visitorId, customerId, canSelectModel } = req.chat;
    if (limiter && tenant.audience === "public") {
      const allowed = await enforceLimits(limiter, tenant, {
        ip: clientIp(req),
        visitorId,
      });
      if (!allowed) {
        return res.status(429).json({ message: "Terlalu banyak permintaan. Coba lagi sebentar." });
      }
    }

    let session = null;
    let modelMode = "pas";
    try {
      if (req.body?.sessionId) {
        session = await store.findSession(req.body.sessionId, visitorId);
        if (!session) return res.status(404).json({ message: "Sesi tidak ditemukan" });
        modelMode = chosenModelMode(req.body?.modelMode || session.modelMode, canSelectModel, tenant);
      } else {
        modelMode = chosenModelMode(req.body?.modelMode, canSelectModel, tenant);
        session = {
          tenantSlug: tenant.slug,
          visitorId,
          customerId,
          modelMode,
          messages: [],
        };
      }
      session.modelMode = modelMode;
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }

    const stream = req.body?.stream !== false;
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.socket?.setNoDelay?.(true);
    }

    try {
      const result = await runTurn({
        tenant,
        session,
        message: req.body?.message,
        context: req.body?.context,
        customerId,
        limiter,
        fetchImpl,
        complete: deps.complete,
        execute: deps.execute,
        env: deps.env,
        onEvent: stream
          ? (event) => writeSse(res, event.type, event.type === "token" ? { text: event.text } : { name: event.name })
          : undefined,
      });
      const saved = await store.saveSession(session);
      if (saved?._id) session._id = saved._id;
      for (const call of result.toolCallsUsed) {
        await store.addAudit({
          tenantSlug: tenant.slug,
          visitorId,
          sessionId: String(session._id),
          toolName: call.name,
          args: call.args,
          latencyMs: call.latencyMs,
          tokens: result.tokensUsed,
          modelMode: session.modelMode || "pas",
          model: session.model || "",
        });
      }
      if (result.handoffRequested && tenant.handoffWebhookUrl) {
        await fetchImpl(tenant.handoffWebhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: session._id,
            visitorId,
            summary: (session.messages || [])
              .filter((item) => item.role === "user" || item.role === "assistant")
              .slice(-8)
              .map((item) => `${item.role}: ${String(item.content || "").slice(0, 400)}`)
              .join("\n"),
          }),
        }).catch(() => null);
      }
      const payload = {
        reply: result.reply,
        sessionId: session._id,
        toolCallsUsed: result.toolCallsUsed.map((call) => call.name),
        tokensUsed: result.tokensUsed,
        action: result.action || null,
        handoffRequested: result.handoffRequested,
        modelMode: session.modelMode || "pas",
        model: session.model || "",
      };
      if (stream) {
        writeSse(res, "done", payload);
        return res.end();
      }
      return res.json(payload);
    } catch (error) {
      const code = error?.cause?.code || error?.code || "";
      console.error("agent chat:", code || error.status || "", error.message);
      const unreachable = code === "EAI_AGAIN" || code === "ENOTFOUND" || code === "ECONNREFUSED" || error.message === "fetch failed";
      const status = error.status || 502;
      const message = unreachable
        ? "Server tidak bisa menghubungi model. Cek DNS atau LLM_BASE_URL."
        : status === 400 || status === 409 || status === 503
          ? error.message
          : "Layanan sedang tidak bisa menjawab. Silakan coba lagi.";
      if (stream) {
        writeSse(res, "error", { message });
        return res.end();
      }
      return res.status(status).json({ message });
    }
  });

  router.get("/sessions", readChat, async (req, res) => {
    const rows = typeof store.listSessions === "function"
      ? await store.listSessions(req.chat.visitorId)
      : [];
    return res.json({
      sessions: (rows || []).filter(hasUserMessage).map((session) => ({
        sessionId: session._id,
        title: sessionTitle(session),
        updatedAt: session.updatedAt || null,
      })),
    });
  });

  router.get("/sessions/:id", readChat, async (req, res) => {
    const session = await store.findSession(req.params.id, req.chat.visitorId);
    if (!session) return res.status(404).json({ message: "Sesi tidak ditemukan" });
    return res.json({
      sessionId: session._id,
      modelMode: session.modelMode || "pas",
      model: session.model || "",
      messages: (session.messages || [])
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({ role: item.role, content: item.content, action: item.action || null })),
    });
  });

  router.post("/handoff", readChat, async (req, res) => {
    const { tenant, visitorId } = req.chat;
    const session = await store.findSession(req.body?.sessionId, visitorId);
    if (!session) return res.status(404).json({ message: "Sesi tidak ditemukan" });
    session.handoffRequested = true;
    await store.saveSession(session);
    if (tenant.handoffWebhookUrl) {
      await fetchImpl(tenant.handoffWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session._id,
          visitorId,
          reason: String(req.body?.reason || "visitor meminta manusia"),
        }),
      }).catch(() => null);
    }
    return res.json({ ok: true, handoffRequested: true });
  });

  router.get("/admin/tenant", authenticate, requireIT, async (_req, res) => {
    const tenant = await store.getTenant();
    return res.json({
      data: {
        ...redactTenant(tenant),
        effective: effectiveLlm(tenant, deps.env || process.env),
        effectiveModes: {
          hemat: effectiveLlm(tenant, deps.env || process.env, "hemat"),
          pas: effectiveLlm(tenant, deps.env || process.env, "pas"),
          kuat: effectiveLlm(tenant, deps.env || process.env, "kuat"),
        },
        modelModes: availableModelModes(tenant, deps.env || process.env),
      },
    });
  });

  router.put("/admin/tenant", authenticate, requireIT, async (req, res) => {
    const current = await store.getTenant();
    const body = req.body || {};
    const next = {
      ...current,
      systemPrompt: body.systemPrompt ?? current.systemPrompt,
      dailyTokenBudget: Number(body.dailyTokenBudget || current.dailyTokenBudget),
      handoffWebhookUrl: body.handoffWebhookUrl ?? current.handoffWebhookUrl,
      allowedOrigins: Array.isArray(body.allowedOrigins)
        ? body.allowedOrigins.map(String)
        : current.allowedOrigins,
      llm: {
        ...(current.llm || {}),
        ...(body.llm || {}),
      },
      llmModes: {
        ...(current.llmModes || {}),
        precise: {
          ...(current.llmModes?.precise || {}),
          ...(body.llmModes?.precise || {}),
        },
      },
    };
    if (Array.isArray(body.enabledTools) && Array.isArray(current.tools)) {
      const enabled = new Set(body.enabledTools);
      next.tools = current.tools.map((tool) => ({
        ...tool,
        enabled: enabled.has(tool.name),
      }));
    }
    try {
      resolveLlm(next, deps.env || process.env);
      if (next.llmModes?.precise?.model || (deps.env || process.env).LLM_PRECISE_MODEL) {
        resolveLlm(next, deps.env || process.env, "precise");
      }
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }
    const saved = await store.saveTenant(next);
    return res.json({ data: redactTenant(saved) });
  });

  return router;
}
