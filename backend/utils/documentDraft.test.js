import assert from "node:assert/strict";
import test from "node:test";
import {
  csvToMarkdown,
  detectImportKind,
  fileToDraft,
  pastedTextToDraft,
} from "./documentDraft.js";

test("csvToMarkdown membuat tabel markdown", () => {
  const md = csvToMarkdown("kode,nama\nA1,Baut\nA2,\"Pipa, 1/2\"");
  assert.match(md, /\| kode \| nama \|/);
  assert.match(md, /\| --- \| --- \|/);
  assert.match(md, /\| A2 \| Pipa, 1\/2 \|/);
});

test("fileToDraft membaca .txt dan .text", async () => {
  const txt = await fileToDraft(Buffer.from("Langkah scan barcode.\nSimpan dulu."), {
    fileName: "cara-scan.txt",
  });
  assert.equal(txt.title, "cara scan");
  assert.match(txt.content, /Langkah scan barcode/);
  assert.equal(txt.summary, "Langkah scan barcode.");

  const text = await fileToDraft(Buffer.from("Catatan gudang internal."), {
    fileName: "catatan-gudang.text",
    mime: "text/plain",
  });
  assert.equal(text.title, "catatan gudang");
  assert.match(text.content, /Catatan gudang internal/);
});

test("fileToDraft membaca CSV", async () => {
  const draft = await fileToDraft(Buffer.from("sku,stok\nX1,12\nX2,0\n"), {
    fileName: "stok-pos.csv",
  });
  assert.equal(draft.title, "stok pos");
  assert.match(draft.content, /\| sku \| stok \|/);
  assert.match(draft.content, /\| X1 \| 12 \|/);
});

test("pastedTextToDraft memakai baris pertama sebagai judul", () => {
  const draft = pastedTextToDraft("# SOP retur toko\n\nScan nota lalu pilih alasan.");
  assert.equal(draft.title, "SOP retur toko");
  assert.match(draft.content, /Scan nota lalu pilih alasan/);
});

test("detectImportKind menolak format asing", () => {
  assert.equal(detectImportKind("foto.png", "image/png"), "");
  assert.equal(detectImportKind("panduan.docx"), "docx");
  assert.equal(detectImportKind("lama.doc"), "doc");
});
