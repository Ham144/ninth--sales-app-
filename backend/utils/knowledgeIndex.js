import HubKnowledgeDoc from "../models/HubKnowledgeDoc.model.js";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS = 24;

export function embeddingConfig(env = process.env) {
  return {
    baseUrl: String(env.EMBEDDING_BASE_URL || env.LLM_BASE_URL || "").replace(/\/$/, ""),
    apiKey: env.EMBEDDING_API_KEY || env.LLM_API_KEY || "",
    model: env.EMBEDDING_MODEL || "openai/text-embedding-3-small",
  };
}

export function splitChunks(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks = [];
  let start = 0;
  while (start < clean.length && chunks.length < MAX_CHUNKS) {
    const slice = clean.slice(start, start + size);
    chunks.push({
      chunkIndex: chunks.length,
      text: slice,
      tokenEstimate: Math.ceil(slice.length / 4),
    });
    if (start + size >= clean.length) break;
    start += size - overlap;
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

export function sourceText(doc) {
  return [doc?.title, doc?.summary, doc?.content].filter(Boolean).join("\n\n");
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

export async function indexFields(doc, deps = {}) {
  const chunks = splitChunks(sourceText(doc));
  if (!chunks.length) {
    return { chunks: [], hasEmbeddings: false, embeddingModel: null };
  }
  try {
    const vectors = await embedTexts(chunks.map((chunk) => chunk.text), deps);
    if (vectors.length !== chunks.length || !vectors.every((vector) => vector?.length)) {
      throw new Error("embedding kosong");
    }
    return {
      chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] })),
      hasEmbeddings: true,
      embeddingModel: embeddingConfig(deps.env).model,
    };
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
    text,
    score,
    hasEmbeddings: Boolean(doc.hasEmbeddings),
  };
}

async function textPassages(Model, query, visibility, limit) {
  const filter = { $text: { $search: query } };
  if (visibility) filter.visibility = visibility;
  const docs = await Model.find(filter, { score: { $meta: "textScore" } })
    .select("slug title docType summary content appTitle tags visibility hasEmbeddings")
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .lean();
  return docs.map((doc) =>
    passageFromDoc(doc, doc.summary || String(doc.content || "").slice(0, 900), doc.score),
  );
}

export async function retrieveKnowledge({
  q,
  visibility,
  limit = 5,
  Model = HubKnowledgeDoc,
  fetchImpl,
  env,
} = {}) {
  const query = String(q || "").trim();
  const cap = Math.min(Math.max(Number(limit) || 5, 1), 30);
  let vector = null;
  try {
    const [embedded] = await embedTexts([query], { fetchImpl, env });
    vector = embedded;
  } catch {
    vector = null;
  }

  if (vector?.length) {
    const filter = { hasEmbeddings: true };
    if (visibility) filter.visibility = visibility;
    const docs = await Model.find(filter)
      .select("+chunks.embedding slug title docType summary appTitle tags visibility hasEmbeddings")
      .lean();
    const hits = [];
    for (const doc of docs) {
      for (const chunk of doc.chunks || []) {
        if (!chunk.embedding?.length) continue;
        hits.push(passageFromDoc(doc, chunk.text, cosine(vector, chunk.embedding)));
      }
    }
    hits.sort((a, b) => b.score - a.score);
    if (hits.length) return { mode: "vector", data: hits.slice(0, cap) };
  }

  const data = await textPassages(Model, query, visibility, cap);
  return { mode: "text", data };
}

let reindexStarted = false;

export function scheduleKnowledgeReindex(deps = {}) {
  if (reindexStarted) return;
  reindexStarted = true;
  reindexMissing(deps).catch((error) => {
    console.warn("[rag] reindex gagal:", error.message);
  });
}

async function reindexMissing(deps) {
  const pending = await HubKnowledgeDoc.find({ hasEmbeddings: { $ne: true } })
    .select("title summary content")
    .lean();
  for (const doc of pending) {
    const indexed = await indexFields(doc, deps);
    if (!indexed.hasEmbeddings) return;
    await HubKnowledgeDoc.updateOne({ _id: doc._id }, { $set: indexed });
  }
  if (pending.length) console.log(`[rag] embedded ${pending.length} docs`);
}
