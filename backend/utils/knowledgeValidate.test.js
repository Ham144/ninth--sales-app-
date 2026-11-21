import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_KNOWLEDGE_CONTENT_CHARS,
  assertKnowledgeDoc,
  KnowledgeValidateError,
} from "./knowledgeValidate.js";

test("assertKnowledgeDoc menolak tanpa tag aplikasi", () => {
  assert.throws(
    () =>
      assertKnowledgeDoc({
        docType: "howto",
        title: "Cara retur",
        content: "Scan nota lalu simpan ke sistem gudang dengan teliti.",
        tags: [],
      }),
    (err) => err instanceof KnowledgeValidateError && /tag/i.test(err.message),
  );
});

test("assertKnowledgeDoc menolak konten oversized curated", () => {
  assert.throws(
    () =>
      assertKnowledgeDoc({
        docType: "technical",
        title: "Dump",
        content: "x".repeat(MAX_KNOWLEDGE_CONTENT_CHARS + 1),
        tags: ["others"],
      }),
    (err) => err instanceof KnowledgeValidateError && /80\.000|80000|terlalu besar/i.test(err.message),
  );
});

test("assertKnowledgeDoc menerima dokumen bertag", () => {
  const { warnings } = assertKnowledgeDoc({
    docType: "howto",
    title: "Cara retur",
    content: "Scan nota lalu simpan. Pastikan lokasi benar sebelum submit.",
    tags: ["catur-pos"],
    visibility: "internal",
  });
  assert.ok(Array.isArray(warnings));
});
