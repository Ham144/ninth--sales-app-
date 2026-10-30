import assert from "node:assert/strict";
import test from "node:test";
import { cosine, indexFields, retrieveKnowledge, splitChunks } from "./knowledgeIndex.js";

test("splitChunks memotong teks panjang dengan overlap", () => {
  const chunks = splitChunks("a".repeat(2500), 1200, 200);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[1].text.startsWith("a"), true);
  assert.ok(chunks.at(-1).text.length <= 1200);
});

test("cosine mengurutkan vektor yang searah lebih tinggi", () => {
  assert.ok(cosine([1, 0], [1, 0]) > cosine([1, 0], [0, 1]));
  assert.equal(cosine([], [1]), 0);
});

test("indexFields menyimpan vektor bila endpoint embedding menjawab", async () => {
  const indexed = await indexFields(
    { title: "Cek stok", summary: "", content: "Buka lokasi lalu baca angka." },
    {
      env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k", EMBEDDING_MODEL: "m" },
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
    },
  );
  assert.equal(indexed.hasEmbeddings, true);
  assert.deepEqual(indexed.chunks[0].embedding, [1, 0]);
  assert.equal(indexed.embeddingModel, "m");
});

test("retrieveKnowledge memakai vektor, lalu teks bila embedding gagal", async () => {
  const stored = [
    {
      _id: "1",
      slug: "stok",
      title: "Cek stok",
      docType: "howto",
      visibility: "public",
      hasEmbeddings: true,
      tags: [],
      chunks: [{ text: "angka stok per lokasi", embedding: [1, 0] }],
    },
  ];
  const Model = {
    find() {
      return {
        select() {
          return this;
        },
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        lean: async () => stored,
      };
    },
  };
  const vector = await retrieveKnowledge({
    q: "stok lokasi",
    Model,
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
  });
  assert.equal(vector.mode, "vector");
  assert.equal(vector.data[0].slug, "stok");

  const text = await retrieveKnowledge({
    q: "stok",
    Model,
    fetchImpl: async () => new Response("{}", { status: 503 }),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
  });
  assert.equal(text.mode, "text");
});
