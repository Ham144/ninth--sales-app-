import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeMongoArgs,
  buildMongoReadFilter,
  buildMongoReadPipeline,
  buildMongoReadSort,
  listMongoReadCollections,
  runMongoRead,
} from "./mongoRead.js";
import { executeTool, MIDCSI_TOOLS } from "./tools.js";

test("hub_data_query Level B terdaftar", () => {
  const tool = MIDCSI_TOOLS.find((item) => item.name === "hub_data_query");
  assert.equal(tool?.internal, "hub_data_query");
  assert.deepEqual(tool.parameters.properties.mode.enum, ["find", "aggregate", "lines"]);
  assert.equal(tool.parameters.properties.filters.items.properties.op.enum.includes("between"), true);
  assert.equal(tool.parameters.properties.metrics.items.properties.op.enum.includes("avg"), true);
  const sales = listMongoReadCollections().find((item) => item.name === "sales_orders");
  assert.equal(sales.supportsCustomerLookup, true);
  assert.equal(sales.supportsLines, true);
});

test("filter allowlist menolak field dan operator berbahaya", () => {
  assert.throws(
    () => buildMongoReadFilter("sales_orders", [{ field: "$where", op: "eq", value: "1" }]),
    /tidak diizinkan/,
  );
  assert.throws(
    () => buildMongoReadFilter("sales_orders", [{ field: "password", op: "eq", value: "x" }]),
    /tidak diizinkan/,
  );
  assert.throws(
    () =>
      buildMongoReadFilter("customers", [
        { field: "City", op: "eq", value: { $gt: "" } },
      ]),
    /objek tidak diizinkan/,
  );
  assert.throws(() => assertSafeMongoArgs({ pipeline: [{ $where: "1" }] }), /berbahaya/);
  const filter = buildMongoReadFilter("sales_orders", [
    { field: "SalespersonCode", op: "eq", value: "SMD" },
    { field: "status", op: "eq", value: "completed" },
  ]);
  assert.equal(filter.$and.length, 2);
  const between = buildMongoReadFilter("sales_orders", [
    { field: "OrderDate", op: "between", value: ["2026-01-01", "2026-01-31"] },
  ]);
  assert.equal(between.OrderDate.$gte instanceof Date, true);
  assert.equal(between.OrderDate.$lte instanceof Date, true);
  const sort = buildMongoReadSort("sales_orders", [{ field: "OrderDate", dir: "desc" }]);
  assert.equal(sort.OrderDate, -1);
});

test("pipeline Level B: lookup customer + unwind lines + aggregate metrics", () => {
  const withCustomer = buildMongoReadPipeline("sales_orders", {
    collection: "sales_orders",
    includeCustomer: true,
    filters: [
      { field: "customerCity", op: "eq", value: "Bandung" },
      { field: "status", op: "eq", value: "completed" },
    ],
    limit: 5,
  });
  assert.equal(withCustomer.withCustomer, true);
  assert.equal(
    withCustomer.pipeline.some((stage) => stage.$lookup),
    true,
  );
  assert.equal(
    withCustomer.pipeline.some((stage) => stage.$match?.customerCity === "Bandung"),
    true,
  );

  const lines = buildMongoReadPipeline("sales_orders", {
    mode: "lines",
    filters: [{ field: "line.ItemNo", op: "eq", value: "CAT-1" }],
    limit: 99,
  });
  assert.equal(lines.mode, "lines");
  assert.equal(lines.limit, 40);
  assert.equal(
    lines.pipeline.some((stage) => stage.$unwind?.path === "$SalesLine"),
    true,
  );
  assert.equal(
    lines.pipeline.some((stage) => stage.$match?.["SalesLine.ItemNo"] === "CAT-1"),
    true,
  );

  const agg = buildMongoReadPipeline("sales_orders", {
    mode: "aggregate",
    groupBy: ["SalespersonCode"],
    metrics: [
      { op: "count" },
      { op: "sum", field: "SalesLineTotal" },
      { op: "avg", field: "SalesLineTotal" },
    ],
    filters: [{ field: "OrderDate", op: "between", value: { from: "2026-01-01", to: "2026-03-31" } }],
  });
  assert.equal(agg.mode, "aggregate");
  const group = agg.pipeline.find((stage) => stage.$group).$group;
  assert.equal(group.count.$sum, 1);
  assert.equal(group.sum_SalesLineTotal.$sum, "$SalesLineTotal");
  assert.equal(group.avg_SalesLineTotal.$avg, "$SalesLineTotal");
});

test("runMongoRead menolak koleksi dan kunci berbahaya", async () => {
  const denied = await runMongoRead({ collection: "users" });
  assert.equal(denied.error, "koleksi tidak diizinkan");
  const bad = await runMongoRead({
    collection: "sales_orders",
    $where: "this.x == 1",
  });
  assert.match(bad.error, /berbahaya|ditolak/);
});

test("executeTool hub_data_query memanggil executor read-only", async () => {
  const tool = MIDCSI_TOOLS.find((item) => item.name === "hub_data_query");
  const result = await executeTool({
    tool,
    args: {
      collection: "sales_orders",
      mode: "aggregate",
      groupBy: ["SalespersonCode"],
      metrics: [{ op: "avg", field: "SalesLineTotal" }],
      limit: 5,
    },
    executors: {
      hub_data_query: async (args) => ({
        collection: args.collection,
        mode: args.mode,
        returned: 1,
        limit: 5,
        data: [{ SalespersonCode: "SMD", avg_SalesLineTotal: 1200 }],
        note: "mock",
      }),
    },
  });
  assert.equal(result.payload.collection, "sales_orders");
  assert.equal(result.payload.data[0].avg_SalesLineTotal, 1200);
  assert.equal(result.payload.data[0].secret, undefined);
});
