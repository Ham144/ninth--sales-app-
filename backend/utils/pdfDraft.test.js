import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfToDraft } from "./pdfDraft.js";

async function samplePdf() {
  const png = new PNG({ width: 32, height: 32 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 44;
    png.data[i + 1] = 57;
    png.data[i + 2] = 142;
    png.data[i + 3] = 255;
  }
  const doc = await PDFDocument.create();
  doc.setTitle("Panduan penerimaan barang");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 500]);
  page.drawText("Panduan penerimaan barang", { x: 40, y: 460, size: 18, font });
  page.drawText("Scan barcode lalu simpan.", { x: 40, y: 420, size: 12, font });
  const image = await doc.embedPng(PNG.sync.write(png));
  page.drawImage(image, { x: 40, y: 300, width: 80, height: 80 });
  page.drawText("Langkah berikutnya: cetak label.", { x: 40, y: 260, size: 12, font });
  return Buffer.from(await doc.save());
}

test("pdfToDraft menyusun judul, teks, dan gambar tanpa menyimpan artikel", async () => {
  const saved = [];
  const draft = await pdfToDraft(await samplePdf(), {
    fileName: "penerimaan.pdf",
    saveImage: async (bytes, ext) => {
      saved.push({ ext, head: [...bytes.subarray(0, 4)] });
      return "/uploads/contoh.png";
    },
  });

  assert.equal(draft.title, "Panduan penerimaan barang");
  assert.equal(draft.summary, "Scan barcode lalu simpan.");
  assert.equal(draft.imageCount, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].ext, "png");
  assert.deepEqual(saved[0].head, [0x89, 0x50, 0x4e, 0x47]);
  const scan = draft.content.indexOf("Scan barcode lalu simpan.");
  const figure = draft.content.indexOf("![Scan barcode lalu simpan.](/uploads/contoh.png)");
  const next = draft.content.indexOf("Langkah berikutnya: cetak label.");
  assert.ok(scan >= 0 && figure > scan && next > figure);
});

test("pdfToDraft memakai nama berkas bila judul PDF kosong", async () => {
  const doc = await PDFDocument.create();
  doc.setTitle("Untitled");
  const page = doc.addPage([300, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Isi panduan retur.", { x: 40, y: 120, size: 12, font });
  const draft = await pdfToDraft(Buffer.from(await doc.save()), {
    fileName: "cara-retur.pdf",
    saveImage: async () => "/uploads/x.png",
  });
  assert.equal(draft.title, "cara retur");
  assert.match(draft.content, /Isi panduan retur/);
  assert.equal(draft.imageCount, 0);
});
