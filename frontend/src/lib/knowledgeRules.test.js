import assert from "node:assert/strict";
import test from "node:test";
import {
  collectCustomCategories,
  isBlockedSpreadsheet,
  suggestKnowledgeTags,
  validateImportFile,
  validateKnowledgeDraft,
} from "./knowledgeRules.js";

test("validateImportFile menolak xlsx", () => {
  const err = validateImportFile({ name: "list.xlsx", size: 100, type: "" });
  assert.match(err, /CSV|XLSX/i);
  assert.equal(isBlockedSpreadsheet({ name: "a.xls" }), true);
});

test("validateKnowledgeDraft wajib tag", () => {
  const err = validateKnowledgeDraft({
    title: "SOP",
    content: "Langkah pertama sampai selesai dengan jelas untuk staf gudang.",
    tags: [],
  });
  assert.match(err, /aplikasi|Others|kategori/i);
});

test("suggestKnowledgeTags mengisi others + topik dari nama berkas", () => {
  const out = suggestKnowledgeTags({
    apps: [{ id: "catur-pos", title: "catur pos", url: "/pos" }],
    fileName: "daftar-harga-kipas.csv",
    title: "daftar harga kipas",
    content: "sku,harga\nA1,1000\n",
  });
  assert.ok(out.tags.includes("others") || out.appId);
  assert.ok(out.tags.includes("harga") || out.tags.includes("katalog"));
});

test("collectCustomCategories mengumpulkan tag non-app", () => {
  const tags = collectCustomCategories(
    [{ tags: ["catur-pos", "harga", "others"] }, { tags: ["harga", "sop"] }],
    [{ id: "catur-pos" }],
  );
  assert.deepEqual(tags, ["harga", "sop"]);
});
