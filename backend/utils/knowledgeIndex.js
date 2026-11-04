import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import HubKnowledgeDoc from "../models/HubKnowledgeDoc.model.js";
import { createQdrantStore, qdrantUrlFrom } from "./qdrantStore.js";

/**
 * RAG knowledge store. Mongo holds the documents; Qdrant holds vectors when QDRANT_URL is set.
 * Every chunk must be self-contained (title, app, table headers).
 */

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS = 200; // document/text is too large (jaga ram)
const RRF_K = 60;
export const TOP_K = 5;
export const CHUNKS_PER_DOC = {
  howto: 1,
  technical: 4,
};

function chunksAllowed(docType) {
  return CHUNKS_PER_DOC[docType] || CHUNKS_PER_DOC.howto;
}

export function embeddingConfig(env = process.env) {
  return {
    baseUrl: String(env.EMBEDDING_BASE_URL || env.LLM_BASE_URL || "").replace(/\/$/, ""),
    apiKey: env.EMBEDDING_API_KEY || env.LLM_API_KEY || "",
    model: "openai/text-embedding-3-small",
  };
}

export function sourceText(doc) {
  return [doc?.title, doc?.summary, doc?.content].filter(Boolean).join("\n\n");
}

export function docHash(doc) {
  return createHash("sha256").update(sourceText(doc)).digest("hex").slice(0, 16);
}

export function needsReindex(doc, env = process.env) {
  if (!doc) return false;
  return (
    !doc.hasEmbeddings ||
    doc.contentHash !== docHash(doc) ||
    doc.embeddingModel !== embeddingConfig(env).model
  );
}

function splitCells(line) {
  let text = String(line || "").trim();
  if (!text.startsWith("|")) text = `|${text}`;
  if (!text.endsWith("|")) text = `${text}|`;
  return text
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isTableRow(line) {
  const trimmed = String(line || "").trim();
  return trimmed.includes("|") && trimmed.replace(/\|/g, "").trim() !== "";
}

function isTableSep(line) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(String(line || "").trim());
}

export function expandMarkdownTables(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && isTableSep(lines[i + 1] || "")) {
      const header = splitCells(lines[i]).filter(Boolean);
      i += 2;
      while (i < lines.length && isTableRow(lines[i]) && !isTableSep(lines[i])) {
        const cells = splitCells(lines[i]);
        const pairs = header
          .map((name, index) => `${name}: ${cells[index] || ""}`.trim())
          .filter((part) => !part.endsWith(":"));
        if (pairs.length) out.push(`Baris tabel. ${pairs.join("; ")}`);
        i += 1;
      }
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join("\n");
}

export function chunkContextPrefix(doc = {}) {
  const bits = [doc.docType, doc.appId || doc.appTitle, doc.title]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return bits.length ? `[${bits.join(" | ")}] ` : "";
}

export function splitChunks(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP, context = {}) {
  const raw = expandMarkdownTables(String(text || ""))
    .replace(/\r\n/g, "\n")
    .trim();
  if (!raw) return [];
  const prefix = chunkContextPrefix(context);
  const budget = Math.max(200, size - prefix.length);
  const parts = raw
    .split(/\n{2,}|(?=^#{1,3}\s)/m)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const blocks = [];
  let buffer = "";
  for (const part of parts) {
    if (!buffer) {
      buffer = part;
      continue;
    }
    if (buffer.length + 1 + part.length <= budget) {
      buffer = `${buffer} ${part}`;
    } else {
      blocks.push(buffer);
      buffer = part;
    }
  }
  if (buffer) blocks.push(buffer);

  const chunks = [];
  for (const block of blocks) {
    if (chunks.length >= MAX_CHUNKS) break;
    if (block.length <= budget) {
      const text = `${prefix}${block}`.trim();
      chunks.push({
        chunkIndex: chunks.length,
        text,
        tokenEstimate: Math.ceil(text.length / 4),
      });
      continue;
    }
    let start = 0;
    while (start < block.length && chunks.length < MAX_CHUNKS) {
      const slice = `${prefix}${block.slice(start, start + budget)}`.trim();
      chunks.push({
        chunkIndex: chunks.length,
        text: slice,
        tokenEstimate: Math.ceil(slice.length / 4),
      });
      if (start + budget >= block.length) break;
      start += budget - overlap;
    }
  }
  return chunks;
}

export function cosine(left, right) {
  const width = Math.min(left?.length || 0, right?.length || 0);
  if (!width) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < width; i += 1) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function embedTexts(inputs, { fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const { baseUrl, apiKey, model } = embeddingConfig(env);
  if (!baseUrl || !apiKey) {
    const error = new Error("embedding belum dikonfigurasi");
    error.status = 503;
    throw error;
  }
  const response = await fetchImpl(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: inputs }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "embedding ditolak");
    error.status = 502;
    throw error;
  }
  return (Array.isArray(data.data) ? data.data : [])
    .slice()
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((row) => row.embedding);
}

function resolveVectorStore(deps = {}) {
  if (deps.vectorStore) return deps.vectorStore;
  if (deps.vectorStore === null) return null;
  const env = deps.env || process.env;
  const url = qdrantUrlFrom(env);
  if (!url) return null;
  return createQdrantStore({ url, fetchImpl: deps.fetchImpl, env });
}

export async function removeKnowledgeVectors(slug, deps = {}) {
  const store = resolveVectorStore(deps);
  if (!store?.deleteSlug || !slug) return;
  try {
    await store.deleteSlug(slug);
  } catch (error) {
    console.warn("[rag] qdrant delete gagal:", error.message);
  }
}

async function syncVectorStore(doc, indexed, deps = {}) {
  const store = resolveVectorStore(deps);
  if (!store) return;
  try {
    if (indexed.hasEmbeddings) {
      await store.upsertDoc({ ...doc, ...indexed });
    } else if (doc.slug && store.deleteSlug) {
      await store.deleteSlug(doc.slug);
    }
  } catch (error) {
    console.warn("[rag] qdrant sync gagal:", error.message);
  }
}

export async function indexFields(doc, deps = {}) {
  const chunks = splitChunks(sourceText(doc), CHUNK_SIZE, CHUNK_OVERLAP, {
    title: doc.title,
    appId: doc.appId,
    appTitle: doc.appTitle,
    docType: doc.docType,
  });
  const hash = docHash(doc);
  if (!chunks.length) {
    return { chunks: [], hasEmbeddings: false, embeddingModel: null, contentHash: hash };
  }
  try {
    const vectors = await embedTexts(
      chunks.map((chunk) => chunk.text),
      deps,
    );
    if (vectors.length !== chunks.length || !vectors.every((vector) => vector?.length)) {
      throw new Error("embedding kosong");
    }
    const indexed = {
      chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] })),
      hasEmbeddings: true,
      embeddingModel: embeddingConfig(deps.env).model,
      contentHash: hash,
    };
    await syncVectorStore(doc, indexed, deps);
    return indexed;
  } catch (error) {
    console.warn("[rag] embedding gagal:", error.message);
    return { chunks, hasEmbeddings: false, embeddingModel: null };
  }
}

export function withoutEmbeddings(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...doc };
  if (Array.isArray(plain.chunks)) {
    plain.chunks = plain.chunks.map(({ embedding, ...rest }) => rest);
  }
  return plain;
}

function passageFromDoc(doc, text, score) {
  return {
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    docType: doc.docType,
    appTitle: doc.appTitle || null,
    tags: doc.tags || [],
    visibility: doc.visibility,
    text: String(text || ""),
    score,
    hasEmbeddings: Boolean(doc.hasEmbeddings),
  };
}

function passageKey(item) {
  return `${item.slug || item.id}:${String(item.text || "").slice(0, 96)}`;
}

export function reciprocalRankMerge(lists, cap, k = RRF_K) {
  const scores = new Map();
  const items = new Map();
  for (const list of lists) {
    (list || []).forEach((item, rank) => {
      const key = passageKey(item);
      if (!items.has(key)) items.set(key, item);
      scores.set(key, (scores.get(key) || 0) + 1 / (k + rank + 1));
    });
  }
  return collapseByDoc(
    [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, score]) => ({ ...items.get(key), score })),
    cap,
  );
}

export function collapseByDoc(hits, topK) {
  const bySlug = new Map();
  for (const hit of hits) {
    const slug = hit.slug || String(hit.id || "");
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(hit);
  }
  const docs = [];
  for (const [, group] of bySlug) {
    const allowed = chunksAllowed(group[0]?.docType);
    const seen = new Set();
    const unique = [];
    group.sort(
      (a, b) =>
        (Number(b.score) || 0) - (Number(a.score) || 0) ||
        String(b.text || "").length - String(a.text || "").length,
    );
    for (const hit of group) {
      const key = String(hit.text || "").slice(0, 96);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(hit);
      if (unique.length >= allowed) break;
    }
    docs.push({ best: Number(unique[0]?.score) || 0, chunks: unique });
  }
  docs.sort((a, b) => b.best - a.best);
  return docs.slice(0, topK).flatMap((doc) => doc.chunks);
}

async function textPassages(Model, query, visibility, top_k) {
  const cap = Math.min(Math.max(Number(top_k) || TOP_K, 1), 30);
  const visibilityFilter = visibility ? { visibility } : {};
  try {
    const docs = await Model.find(
      { $text: { $search: query }, ...visibilityFilter },
      { score: { $meta: "textScore" } },
    )
      .select("slug title docType summary content appTitle tags visibility hasEmbeddings")
      .sort({ score: { $meta: "textScore" } })
      .limit(cap)
      .lean();
    return docs.map((doc) =>
      passageFromDoc(doc, doc.summary || String(doc.content || "").slice(0, 900), doc.score),
    );
  } catch {
    const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    const docs = await Model.find({
      ...visibilityFilter,
      $or: [{ title: rx }, { summary: rx }, { content: rx }, { tags: rx }, { searchText: rx }],
    })
      .select("slug title docType summary content appTitle tags visibility hasEmbeddings")
      .limit(cap)
      .lean();
    return docs.map((doc) =>
      passageFromDoc(doc, doc.summary || String(doc.content || "").slice(0, 900), 1),
    );
  }
}

async function mongoVectorHits(Model, vector, visibility, pool) {
  const filter = { hasEmbeddings: true };
  if (visibility) filter.visibility = visibility;
  const docs = await Model.find(filter).select("+chunks.embedding").lean();
  const hits = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks || []) {
      if (!chunk.text || !chunk.embedding?.length) continue;
      hits.push(passageFromDoc(doc, chunk.text, cosine(vector, chunk.embedding)));
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, pool);
}

export async function retrieveKnowledge({
  q,
  visibility,
  top_k = TOP_K,
  Model = HubKnowledgeDoc,
  fetchImpl,
  env,
  vectorStore,
  ...deps
} = {}) {
  const query = String(q || "").trim();
  const cap = Math.min(Math.max(Number(top_k) || TOP_K, 1), 30);
  let vector = null;
  try {
    const [embedded] = await embedTexts([query], { fetchImpl, env });
    vector = embedded;
  } catch {
    vector = null;
  }

  const pool = cap * Math.max(...Object.values(CHUNKS_PER_DOC)) * 2;
  let vectorHits = [];
  if (vector?.length) {
    const store = resolveVectorStore({ fetchImpl, env, vectorStore, ...deps });
    if (store) {
      try {
        vectorHits = await store.search({ vector, visibility, limit: pool });
      } catch (error) {
        console.warn("[rag] qdrant search gagal, fallback Mongo:", error.message);
      }
    }
    if (!vectorHits.length) {
      vectorHits = await mongoVectorHits(Model, vector, visibility, pool);
    }
  }

  let textHits = [];
  try {
    textHits = await textPassages(Model, query, visibility, cap);
  } catch {
    textHits = [];
  }

  if (vectorHits.length && textHits.length) {
    return { mode: "hybrid", data: reciprocalRankMerge([vectorHits, textHits], cap) };
  }
  if (vectorHits.length) return { mode: "vector", data: collapseByDoc(vectorHits, cap) };
  return { mode: "text", data: collapseByDoc(textHits, cap) };
}

let reindexPromise = null;

export function scheduleKnowledgeReindex(deps = {}) {
  if (!reindexPromise) {
    reindexPromise = reindexKnowledge(deps).finally(() => {
      reindexPromise = null;
    });
  }
  return reindexPromise;
}

export async function reindexKnowledge(deps = {}) {
  const Model = deps.Model || HubKnowledgeDoc;
  const pending = await Model.find({})
    .select("+chunks.embedding")
    .lean();
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  for (const doc of pending) {
    if (!needsReindex(doc, deps.env)) {
      await syncVectorStore(doc, { hasEmbeddings: doc.hasEmbeddings, chunks: doc.chunks || [] }, deps);
      skipped += 1;
      continue;
    }
    const indexed = await indexFields(doc, deps);
    if (!indexed.hasEmbeddings) {
      failed += 1;
      continue;
    }
    await Model.updateOne({ _id: doc._id }, { $set: indexed });
    updated += 1;
  }
  if (updated || failed) {
    console.log(`[rag] embedded ${updated} docs, skipped ${skipped}, failed ${failed}`);
  }
  return { updated, skipped, failed };
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  await import("dotenv/config");
  const { default: mongoose } = await import("mongoose");
  const { connectDB } = await import("./connectDB.js");
  await connectDB();
  const result = await reindexKnowledge();
  console.log(
    `[rag] index selesai: ${result.updated} diubah, ${result.skipped} sudah mutakhir, ${result.failed} gagal`,
  );
  await mongoose.disconnect();
}
