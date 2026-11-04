import { createHash } from "node:crypto";

export const DEFAULT_COLLECTION = "hub_knowledge";

export function qdrantUrlFrom(env = process.env) {
  return String(env.QDRANT_URL || "").trim().replace(/\/$/, "");
}

export function pointId(slug, chunkIndex) {
  const hex = createHash("sha1")
    .update(`${String(slug || "")}:${Number(chunkIndex) || 0}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function collectionName(env = process.env) {
  return String(env.QDRANT_COLLECTION || DEFAULT_COLLECTION).trim() || DEFAULT_COLLECTION;
}

async function qdrantFetch(baseUrl, path, { method = "GET", body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.status?.error || data?.error || response.statusText;
    throw new Error(`qdrant ${path}: ${detail}`);
  }
  return data;
}

export function createQdrantStore({
  url,
  collection,
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  const baseUrl = String(url || qdrantUrlFrom(env)).replace(/\/$/, "");
  const name = collection || collectionName(env);
  let ensuredSize = 0;

  async function ensureCollection(size) {
    if (!size || ensuredSize === size) return;
    const existing = await fetchImpl(`${baseUrl}/collections/${encodeURIComponent(name)}`);
    if (existing.ok) {
      ensuredSize = size;
      return;
    }
    await qdrantFetch(baseUrl, `/collections/${encodeURIComponent(name)}`, {
      method: "PUT",
      fetchImpl,
      body: {
        vectors: { size, distance: "Cosine" },
      },
    });
    for (const field of ["slug", "visibility", "docType", "appId"]) {
      await qdrantFetch(baseUrl, `/collections/${encodeURIComponent(name)}/index`, {
        method: "PUT",
        fetchImpl,
        body: { field_name: field, field_schema: "keyword" },
      }).catch(() => {});
    }
    ensuredSize = size;
  }

  return {
    async upsertDoc(doc) {
      const chunks = (doc.chunks || []).filter((chunk) => chunk?.embedding?.length && chunk.text);
      if (!chunks.length || !doc.slug) return { upserted: 0 };
      await ensureCollection(chunks[0].embedding.length);
      await this.deleteSlug(doc.slug);
      await qdrantFetch(
        baseUrl,
        `/collections/${encodeURIComponent(name)}/points?wait=true`,
        {
          method: "PUT",
          fetchImpl,
          body: {
            points: chunks.map((chunk) => ({
              id: pointId(doc.slug, chunk.chunkIndex),
              vector: chunk.embedding,
              payload: {
                slug: doc.slug,
                title: doc.title || "",
                docType: doc.docType || "",
                appId: doc.appId || "",
                appTitle: doc.appTitle || "",
                visibility: doc.visibility || "internal",
                tags: Array.isArray(doc.tags) ? doc.tags : [],
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
              },
            })),
          },
        },
      );
      return { upserted: chunks.length };
    },

    async deleteSlug(slug) {
      if (!slug) return;
      const existing = await fetchImpl(`${baseUrl}/collections/${encodeURIComponent(name)}`);
      if (!existing.ok) return;
      await qdrantFetch(
        baseUrl,
        `/collections/${encodeURIComponent(name)}/points/delete?wait=true`,
        {
          method: "POST",
          fetchImpl,
          body: {
            filter: { must: [{ key: "slug", match: { value: String(slug) } }] },
          },
        },
      );
    },

    async search({ vector, visibility, limit = 20 } = {}) {
      if (!vector?.length) return [];
      const existing = await fetchImpl(`${baseUrl}/collections/${encodeURIComponent(name)}`);
      if (!existing.ok) return [];
      const filter = visibility
        ? { must: [{ key: "visibility", match: { value: visibility } }] }
        : undefined;
      const data = await qdrantFetch(
        baseUrl,
        `/collections/${encodeURIComponent(name)}/points/search`,
        {
          method: "POST",
          fetchImpl,
          body: {
            vector,
            limit,
            with_payload: true,
            ...(filter ? { filter } : {}),
          },
        },
      );
      return (data.result || []).map((hit) => ({
        slug: hit.payload?.slug,
        title: hit.payload?.title,
        docType: hit.payload?.docType,
        appTitle: hit.payload?.appTitle || null,
        tags: hit.payload?.tags || [],
        visibility: hit.payload?.visibility,
        text: hit.payload?.text || "",
        score: hit.score,
        hasEmbeddings: true,
      }));
    },
  };
}
