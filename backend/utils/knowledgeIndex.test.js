import assert from "node:assert/strict";
import test from "node:test";
import {
  CHUNKS_PER_DOC,
  collapseByDoc,
  cosine,
  docHash,
  expandMarkdownTables,
  indexFields,
  needsReindex,
  reciprocalRankMerge,
  retrieveKnowledge,
  splitChunks,
} from "./knowledgeIndex.js";

function modelFrom(vectorDocs, textDocs = []) {
  return {
    find(filter = {}) {
      const rows = filter.hasEmbeddings ? vectorDocs : textDocs;
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
        lean: async () => rows,
      };
    },
  };
}

test("splitChunks memotong teks panjang dengan overlap", () => {
  const chunks = splitChunks("a".repeat(2500), 1200, 200);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.equal(chunks[1].text.startsWith("a"), true);
  assert.ok(chunks.at(-1).text.length <= 1200);
});

test("splitChunks memisah paragraf sebelum memotong", () => {
  const chunks = splitChunks("Paragraf satu.\n\nParagraf dua yang lain.", 80, 10);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].text, /Paragraf satu/);
  assert.match(chunks[0].text, /Paragraf dua/);
});

test("setiap cuplikan membawa judul dan app, baris tabel membawa header", () => {
  const table = expandMarkdownTables("| No | Web |\n| --- | --- |\n| TI500STI | 34718000 |\n");
  assert.match(table, /No: TI500STI/);
  assert.match(table, /Web: 34718000/);
  const chunks = splitChunks("Scan nota lalu simpan.", 1200, 200, {
    title: "Cara retur",
    appId: "catur-pos",
    docType: "howto",
  });
  assert.match(chunks[0].text, /^\[howto \| catur-pos \| Cara retur\]/);
  assert.match(chunks[0].text, /Scan nota/);
});

test("cosine mengurutkan vektor yang searah lebih tinggi", () => {
  assert.ok(cosine([1, 0], [1, 0]) > cosine([1, 0], [0, 1]));
  assert.equal(cosine([], [1]), 0);
});

test("indexFields menyimpan vektor dan contentHash bila endpoint embedding menjawab", async () => {
  const doc = { title: "Cek stok", summary: "", content: "Buka lokasi lalu baca angka." };
  const indexed = await indexFields(doc, {
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k", EMBEDDING_MODEL: "m" },
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
  });
  assert.equal(indexed.hasEmbeddings, true);
  assert.deepEqual(indexed.chunks[0].embedding, [1, 0]);
  assert.equal(indexed.embeddingModel, "openai/text-embedding-3-small");
  assert.equal(indexed.contentHash, docHash(doc));
  assert.equal(needsReindex({ ...doc, ...indexed }), false);
});

test("indexFields dan retrieve memakai vectorStore bila di-inject", async () => {
  const upserts = [];
  const indexed = await indexFields(
    { slug: "howto-stok", title: "Cek stok", content: "Buka lokasi lalu baca angka." },
    {
      env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
      vectorStore: {
        upsertDoc: async (doc) => {
          upserts.push(doc.slug);
        },
      },
    },
  );
  assert.deepEqual(upserts, ["howto-stok"]);

  const found = await retrieveKnowledge({
    q: "stok",
    Model: modelFrom([]),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.9, 0.1] }] }), { status: 200 }),
    vectorStore: {
      search: async () => [
        { slug: "howto-stok", title: "Cek stok", docType: "howto", text: indexed.chunks[0].text, score: 0.99, hasEmbeddings: true },
      ],
    },
  });
  assert.equal(found.mode, "vector");
  assert.equal(found.data[0].slug, "howto-stok");
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
  const Model = modelFrom(stored, stored);
  const vector = await retrieveKnowledge({
    q: "stok lokasi",
    Model: modelFrom(stored, []),
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
  });
  assert.equal(vector.mode, "vector");
  assert.equal(vector.data[0].slug, "stok");

  const hybrid = await retrieveKnowledge({
    q: "stok lokasi",
    Model,
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 0] }] }), { status: 200 }),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
  });
  assert.equal(hybrid.mode, "hybrid");

  const text = await retrieveKnowledge({
    q: "stok",
    Model,
    fetchImpl: async () => new Response("{}", { status: 503 }),
    env: { EMBEDDING_BASE_URL: "https://embed.test/v1", EMBEDDING_API_KEY: "k" },
  });
  assert.equal(text.mode, "text");
});

test("reciprocalRankMerge menaikkan item yang muncul di kedua daftar", () => {
  const merged = reciprocalRankMerge(
    [
      [
        { slug: "a", text: "satu" },
        { slug: "b", text: "dua" },
      ],
      [{ slug: "b", text: "dua" }],
    ],
    2,
  );
  assert.equal(merged[0].slug, "b");
});

test("howto satu slug satu cuplikan, technical beberapa cuplikan", () => {
  const howto = collapseByDoc(
    [
      { slug: "stok", docType: "howto", text: "judul ringkas isi lengkap prosedur stok", score: 0.2 },
      { slug: "stok", docType: "howto", text: "ringkas", score: 0.2 },
    ],
    3,
  );
  assert.equal(howto.length, 1);
  assert.equal(howto[0].text, "judul ringkas isi lengkap prosedur stok");

  const technical = Array.from({ length: 6 }, (_, index) => ({
    slug: "soap",
    docType: "technical",
    text: `halaman ${index + 1} endpoint dan field`,
    score: 1 - index * 0.1,
  }));
  const kept = collapseByDoc(technical, 1);
  assert.equal(kept.length, CHUNKS_PER_DOC.technical);
  assert.equal(kept[0].text, "halaman 1 endpoint dan field");
  assert.equal(kept.at(-1).text, `halaman ${CHUNKS_PER_DOC.technical} endpoint dan field`);
});
