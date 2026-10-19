import { Router } from "express";
import HubUpdate from "../models/HubUpdate.model.js";
import HubKnowledgeDoc from "../models/HubKnowledgeDoc.model.js";
import HubApp from "../models/HubApp.model.js";
import { seedHubKnowledgeIfEmpty } from "../utils/seedHubKnowledge.js";
import { seedHubAppsIfEmpty } from "../utils/seedHubApps.js";
import authenticate from "../middlewares/authenticate.js";
import requireIT from "../middlewares/requireIT.js";

const router = Router();

let seeded = false;
const ensureSeed = async () => {
  if (seeded) return;
  await Promise.all([seedHubKnowledgeIfEmpty(), seedHubAppsIfEmpty()]);
  seeded = true;
};

const writeGate = [authenticate, requireIT];

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `doc-${Date.now()}`;

// -------- Apps --------
router.get("/apps", async (req, res) => {
  try {
    await ensureSeed();
    const includeInactive = String(req.query.all || "") === "1";
    const query = includeInactive ? {} : { active: true };
    const data = await HubApp.find(query)
      .sort({ sortOrder: 1, title: 1 })
      .lean();
    return res.json({ message: "ok", data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/apps", ...writeGate, async (req, res) => {
  try {
    const body = req.body || {};
    const id = slugify(body.id || body.title);
    if (!body.title || !body.url) {
      return res.status(400).json({ message: "title dan url wajib" });
    }
    const created = await HubApp.create({
      id,
      title: body.title,
      description: body.description || "",
      url: body.url,
      iconUrl: body.iconUrl || null,
      authRequired: body.authRequired !== false,
      sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
      active: body.active !== false,
    });
    return res.status(201).json({ message: "created", data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "id aplikasi sudah dipakai" });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.put("/apps/:id", ...writeGate, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body._id;
    delete body.__v;
    // keep stable slug id unless explicitly changing via body.id (rare)
    if (body.id) body.id = slugify(body.id);
    const updated = await HubApp.findOneAndUpdate(
      { id: req.params.id },
      body,
      { new: true, runValidators: true },
    );
    if (!updated) return res.status(404).json({ message: "not found" });
    return res.json({ message: "updated", data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "id aplikasi sudah dipakai" });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/apps/:id", ...writeGate, async (req, res) => {
  try {
    const deleted = await HubApp.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "not found" });
    return res.json({ message: "deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// -------- Updates (changelog) --------
router.get("/updates", async (req, res) => {
  try {
    await ensureSeed();
    const { search = "", status = "all" } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$text = { $search: String(search) };
    }
    const data = await HubUpdate.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ message: "ok", data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
});

router.post("/updates", ...writeGate, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.projectTitle || !body.task) {
      return res.status(400).json({ message: "projectTitle dan task wajib" });
    }
    const created = await HubUpdate.create({
      projectSlug: body.projectSlug || String(body.projectTitle).toLowerCase(),
      projectTitle: body.projectTitle,
      projectMatched: body.projectMatched !== false,
      task: body.task,
      status: body.status || "pending",
      completedAt:
        body.status === "done" ? body.completedAt || new Date() : null,
      completedBy: body.completedBy || req.user?.username || null,
    });
    return res.status(201).json({ message: "created", data: created });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/updates/bulk", ...writeGate, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ message: "rows kosong" });
    }
    const docs = rows.map((row) => ({
      projectSlug: (row.projectRaw || row.projectTitle || "").toLowerCase(),
      projectTitle: row.projectRaw || row.projectTitle,
      projectMatched: true,
      task: row.task,
      status: row.status || "pending",
      completedAt: row.status === "done" ? new Date() : null,
      completedBy: row.status === "done" ? req.user?.username || "hub" : null,
    }));
    const inserted = await HubUpdate.insertMany(docs);
    return res.status(201).json({ message: "imported", data: inserted });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/updates/:id", ...writeGate, async (req, res) => {
  try {
    const patch = { ...req.body };
    if (patch.status === "done" && !patch.completedAt) {
      patch.completedAt = new Date();
    }
    const updated = await HubUpdate.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "not found" });
    return res.json({ message: "updated", data: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/updates/:id", ...writeGate, async (req, res) => {
  try {
    await HubUpdate.findByIdAndDelete(req.params.id);
    return res.json({ message: "deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// -------- Knowledge docs (howto + technical, RAG corpus) --------
router.get("/docs", async (req, res) => {
  try {
    await ensureSeed();
    const { docType, search = "", tag, appId } = req.query;
    const query = {};
    if (docType) query.docType = docType;
    const appKey = appId || tag;
    if (appKey) {
      query.$or = [{ tags: String(appKey) }, { appId: String(appKey) }];
    }
    if (search) query.$text = { $search: String(search) };
    const data = await HubKnowledgeDoc.find(query)
      .select("-chunks.embedding")
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ message: "ok", data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/docs/by-id/:id", async (req, res) => {
  try {
    const data = await HubKnowledgeDoc.findById(req.params.id)
      .select("-chunks.embedding")
      .lean();
    if (!data) return res.status(404).json({ message: "not found" });
    return res.json({ message: "ok", data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/docs/:slug", async (req, res) => {
  try {
    await ensureSeed();
    const data = await HubKnowledgeDoc.findOne({ slug: req.params.slug })
      .select("-chunks.embedding")
      .lean();
    if (!data) return res.status(404).json({ message: "not found" });
    return res.json({ message: "ok", data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/docs", ...writeGate, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    if (!body.docType || !body.title || !body.content) {
      return res
        .status(400)
        .json({ message: "docType, title, content wajib" });
    }
    if (!body.slug) {
      body.slug = `${body.docType}-${slugify(body.title)}-${Date.now().toString(36)}`;
    }
    body.tags = Array.isArray(body.tags) ? body.tags : [];
    const created = await HubKnowledgeDoc.create(body);
    return res.status(201).json({ message: "created", data: created });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/docs/:id", ...writeGate, async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body._id;
    delete body.__v;
    if (body.tags && !Array.isArray(body.tags)) body.tags = [];
    const updated = await HubKnowledgeDoc.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "not found" });
    return res.json({ message: "updated", data: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/docs/:id", ...writeGate, async (req, res) => {
  try {
    const deleted = await HubKnowledgeDoc.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "not found" });
    return res.json({ message: "deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * Lightweight retrieval endpoint for future RAG:
 * text search over knowledge docs, returns passages (chunks if present else content slice).
 */
router.get("/rag/search", async (req, res) => {
  try {
    await ensureSeed();
    const q = String(req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 30);
    if (!q) return res.status(400).json({ message: "q wajib" });

    const docs = await HubKnowledgeDoc.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } },
    )
      .select("slug title docType summary content appTitle tags chunks.hasEmbeddings")
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();

    const passages = docs.map((doc) => ({
      id: doc._id,
      slug: doc.slug,
      title: doc.title,
      docType: doc.docType,
      appTitle: doc.appTitle,
      tags: doc.tags,
      score: doc.score,
      text: doc.summary || String(doc.content || "").slice(0, 1200),
      hasEmbeddings: Boolean(doc.hasEmbeddings),
    }));

    return res.json({
      message: "ok",
      query: q,
      data: passages,
      note: "Text retrieval now. Vector embeddings can fill HubKnowledgeDoc.chunks.embedding later.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
