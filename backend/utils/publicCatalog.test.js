import assert from "node:assert/strict";
import test from "node:test";
import {
  SENSITIVE_PRODUCT_FIELDS,
  availabilityFromProduct,
  stockByLocation,
  toPublicProduct,
} from "./publicCatalog.js";

test("katalog publik membuang harga B2B dan angka stok", () => {
  const source = {
    No: "ABC",
    Description: "Cat tembok",
    Brand: "CSI",
    organization: "csi",
    updatedAt: "2026-01-01T00:00:00.000Z",
    OS_Price: 125000,
    recgrosir: 99000,
    Dealer: "GROSIR",
    Retail: 150000,
    Inv_PRMT: 40,
    hash: "secret",
  };
  for (const field of SENSITIVE_PRODUCT_FIELDS) {
    if (source[field] === undefined) source[field] = 1;
  }

  const pub = toPublicProduct(source);
  assert.equal(pub.No, "ABC");
  assert.equal(pub.Description, "Cat tembok");
  for (const field of SENSITIVE_PRODUCT_FIELDS) {
    assert.equal(pub[field], undefined, field);
  }

  const availability = availabilityFromProduct(source);
  assert.equal(availability.availability, "available");
  assert.equal(availability.Inv_PRMT, undefined);
  assert.equal(JSON.stringify(availability).includes("125000"), false);
});

test("stok internal per lokasi menyertakan harga Web dan angka", () => {
  const row = stockByLocation({
    No: "ABC",
    Description: "Cat",
    organization: "csi",
    Web: 88000,
    OS_Price: 125000,
    Inv_PRMT: 4,
    Inv_PLUIT: 0,
  });
  assert.equal(row.Web, 88000);
  assert.equal(row.OS_Price, undefined);
  assert.equal(row.locations.find((item) => item.location === "PRMT").qty, 4);
  assert.equal(row.locations.find((item) => item.location === "PLUIT").qty, 0);
});

test("stok nol dilaporkan unavailable tanpa angka", () => {
  const availability = availabilityFromProduct({ No: "Z", Inv_PRMT: 0 });
  assert.equal(availability.availability, "unavailable");
  assert.equal(availability.detail, "coarse");
});
