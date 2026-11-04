import assert from "node:assert/strict";
import test from "node:test";
import { fillImageSlots, isDataImageSrc, isKeepableImageSrc } from "./pasteRich.js";

test("fillImageSlots mengganti slot dengan URL unggahan", () => {
  const md = fillImageSlots("Langkah 1\n\n![Scan barcode](@@IMG_0@@)\n\nLanjut", {
    0: "/uploads/scan.png",
  });
  assert.equal(md, "Langkah 1\n\n![Scan barcode](/uploads/scan.png)\n\nLanjut");
});

test("fillImageSlots menandai gambar yang gagal terbawa", () => {
  const md = fillImageSlots("![Tombol simpan](@@IMG_0@@)", {});
  assert.match(md, /gambar tidak terbawa: Tombol simpan/);
});

test("isKeepableImageSrc menerima uploads dan http", () => {
  assert.equal(isKeepableImageSrc("/uploads/a.png"), true);
  assert.equal(isKeepableImageSrc("https://example.com/a.png"), true);
  assert.equal(isKeepableImageSrc("file:///C:/Temp/x.png"), false);
  assert.equal(isDataImageSrc("data:image/png;base64,aaa"), true);
});
