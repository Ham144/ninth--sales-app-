import assert from "node:assert/strict";
import test from "node:test";
import { compileCustomerQuery, interpretCustomerRanking } from "./customerQuery.js";

test("saldo terbesar bukan nama toko", () => {
  const interpreted = interpretCustomerRanking({
    query: "Customer dengan saldo terbesar",
  });
  assert.equal(interpreted.searchKey, "");
  assert.equal(interpreted.sortBy, "Balance");
  assert.equal(interpreted.sortDir, "desc");
  assert.equal(interpreted.useOverdue, false);
});

test("piutang terbesar tidak diolah sebagai master customer", () => {
  const compiled = compileCustomerQuery({
    query: "Customer dengan piutang terbesar",
  });
  assert.match(compiled.error, /overdue_lookup/);
});

test("compileCustomerQuery menolak field berbahaya", () => {
  const unknown = compileCustomerQuery({
    filters: [{ field: "hash", op: "eq", value: "x" }],
  });
  assert.match(unknown.error, /tidak diizinkan/);
});
