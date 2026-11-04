import assert from "node:assert/strict";
import test from "node:test";
import { compileProductQuery, interpretProductRanking } from "./productQuery.js";

test("pertanyaan ranking tidak dianggap nama produk", () => {
  const interpreted = interpretProductRanking({
    searchKey: "Produk dengan harga Web tertinggi secara keseluruhan",
  });
  assert.equal(interpreted.searchKey, "");
  assert.equal(interpreted.sortBy, "Web");
  assert.equal(interpreted.sortDir, "desc");
});

test("kipas termurah tetap menyisakan kata kipas", () => {
  const interpreted = interpretProductRanking({
    searchKey: "kipas harga web termurah",
  });
  assert.equal(interpreted.searchKey, "kipas");
  assert.equal(interpreted.sortBy, "Web");
  assert.equal(interpreted.sortDir, "asc");
});

test("compileProductQuery menolak field dan value berbahaya", () => {
  const unknown = compileProductQuery({
    filters: [{ field: "hash", op: "eq", value: "x" }],
  });
  assert.match(unknown.error, /tidak diizinkan/);
  const injected = compileProductQuery({
    filters: [{ field: "Web", op: "gt", value: { $gt: 1 } }],
  });
  assert.match(injected.error, /tidak valid/);
});

test("sortBy Web tanpa searchKey adalah scope catalog", () => {
  const compiled = compileProductQuery({ sortBy: "Web", sortDir: "desc" });
  assert.equal(compiled.scope, "catalog");
  assert.deepEqual(compiled.sort, { Web: -1 });
  assert.equal(compiled.searchKey, "");
});

test("sort web_desc lama tetap dipakai", () => {
  const compiled = compileProductQuery({ sort: "web_desc" });
  assert.equal(compiled.sortBy, "Web");
  assert.deepEqual(compiled.sort, { Web: -1 });
});

test("stok pluit terbanyak mengurutkan Inv_PLUIT", () => {
  const interpreted = interpretProductRanking({
    searchKey: "stok pluit terbanyak",
  });
  assert.equal(interpreted.searchKey, "");
  assert.equal(interpreted.sortBy, "Inv_PLUIT");
  assert.equal(interpreted.sortDir, "desc");
});

test("no memakai lookup item", () => {
  const compiled = compileProductQuery({ no: "TI500STI" });
  assert.equal(compiled.scope, "item");
  assert.deepEqual(compiled.extraClauses[0], { No: "TI500STI" });
});
