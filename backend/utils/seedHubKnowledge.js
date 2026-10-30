import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import HubUpdate from "../models/HubUpdate.model.js";
import HubKnowledgeDoc from "../models/HubKnowledgeDoc.model.js";
import { connectDB } from "./connectDB.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirs = [
  path.resolve(__dirname, "../data"),
  path.resolve(__dirname, "../../frontend/src/data"),
];

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function readJson(fileName, fallback) {
  for (const dir of dataDirs) {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, fileName), "utf8"));
    } catch {
      /* try next */
    }
  }
  return fallback;
}

const INTERNAL_GUIDES = [
  {
    slug: "internal-cek-stok",
    title: "Cara cek stok per lokasi",
    appId: "midcsi-so",
    appTitle: "MIDCSI",
    summary: "Cari nomor item terlebih dahulu, lalu cek jumlah stok pada kode lokasi yang dibutuhkan.",
    content:
      "Gunakan nomor item agar hasil stok tidak ambigu. Stok dibaca dari field inventory per lokasi pada data produk. Contoh kode lokasi: PLUIT, GLD_F, dan MNG2 untuk Mangga Dua. Jika nomor item belum diketahui, cari produk berdasarkan nama lalu pilih nomor item yang benar. Angka stok pada agent adalah data internal dan tidak boleh diberikan kepada pengunjung publik.",
    tags: ["stok", "inventory", "lokasi", "produk"],
  },
  {
    slug: "internal-cari-customer",
    title: "Cara mencari customer toko",
    appId: "midcsi-so",
    appTitle: "MIDCSI",
    summary: "Cari customer menggunakan nomor atau bagian nama toko.",
    content:
      "Gunakan nomor customer jika tersedia karena hasilnya paling tepat. Jika hanya mengetahui nama toko, cari dengan bagian nama lalu cocokkan nomor, kota, dan identitas toko sebelum memakai hasil untuk pencarian piutang atau order.",
    tags: ["customer", "toko", "nomor customer"],
  },
  {
    slug: "internal-baca-piutang",
    title: "Cara membaca piutang customer",
    appId: "midcsi-so",
    appTitle: "MIDCSI",
    summary: "Piutang berasal dari dokumen overdue yang tersimpan dan dapat dirinci per customer.",
    content:
      "Peringkat piutang menjumlahkan remainingAmount dari dokumen overdue per nomor customer. Untuk melihat rinciannya, gunakan nomor customer agar dokumen, tanggal jatuh tempo, dan sisa nilai dapat ditampilkan. Data ini adalah snapshot overdue yang tersimpan, bukan saldo live NAV.",
    tags: ["piutang", "overdue", "customer", "jatuh tempo"],
  },
  {
    slug: "internal-buat-sales-order",
    title: "Di mana membuat sales order",
    appId: "s-bit",
    appTitle: "s-bit",
    summary: "Sales order (SO) baru dibuat di aplikasi s-bit.",
    content:
      "Untuk membuat sales order (SO), buka aplikasi s-bit. s-bit adalah Sales Force Automation yang dipakai tenaga penjualan untuk membuat SO ke customer toko. MIDCSI hanya mencari order yang sudah ada dan status NAV.",
    tags: ["sales order", "so", "s-bit", "buat so"],
  },
  {
    slug: "internal-sales-order-status-nav",
    title: "Cara mencari sales order dan status NAV",
    appId: "midcsi-so",
    appTitle: "MIDCSI",
    summary: "DocumentNo hub dihubungkan ke return_value sebelum status live ditanyakan ke NAV.",
    content:
      "Sales order hub memiliki DocumentNo seperti CSI-2026-00110 dan return_value seperti SO/SMD-25/08-00027. Pencarian order dapat memakai salah satu nomor tersebut. Untuk status NAV live, sistem mencari return_value terlebih dahulu lalu mengirimkannya ke layanan CHECKSTATUSNAV. Hasil cache dapat berumur sampai tiga jam.",
    tags: ["sales order", "NAV", "resi", "status", "DocumentNo", "return_value"],
  },
  {
    slug: "internal-pilih-aplikasi",
    title: "Cara memilih aplikasi internal",
    appId: "csi-hub",
    appTitle: "CSI Hub",
    summary: "Pilih aplikasi berdasarkan pekerjaan, organisasi, dan role staf.",
    content:
      "Jelaskan pekerjaan yang ingin dilakukan, misalnya scan invoice CSI, scan invoice RIL, stok opname, approval form, petty cash, service return, atau transaksi POS. Agent mencocokkan kebutuhan tersebut dengan metadata aplikasi dan memberikan link, batasan, update, serta panduan yang tersedia. Jangan memilih aplikasi hanya karena namanya mirip.",
    tags: ["aplikasi", "rekomendasi", "system hub", "panduan"],
  },
  {
    slug: "internal-scan-invoice",
    title: "Memilih aplikasi Scan Invoice CSI atau RIL",
    appId: "invoice-csi",
    appTitle: "Scan Invoice",
    summary: "Gunakan aplikasi Scan Invoice sesuai organisasi dokumen.",
    content:
      "Gunakan Scan Invoice CSI untuk dokumen organisasi CSI dan Scan Invoice RIL untuk dokumen organisasi RIL. Keduanya digunakan untuk mencatat pergerakan barang masuk atau keluar gudang dari invoice. Pastikan organisasi invoice benar sebelum membuka aplikasi.",
    tags: ["scan invoice", "CSI", "RIL", "gudang", "barang masuk"],
  },
  {
    slug: "internal-scan-invoice-ril",
    title: "Memilih aplikasi Scan Invoice RIL",
    appId: "invoice-ril",
    appTitle: "Scan Invoice RIL",
    summary: "Gunakan Scan Invoice RIL untuk pergerakan barang dari dokumen organisasi RIL.",
    content:
      "Gunakan Scan Invoice RIL untuk dokumen organisasi RIL yang berkaitan dengan pencatatan barang masuk atau keluar gudang. Jika dokumennya berasal dari organisasi CSI, gunakan Scan Invoice CSI. Pastikan organisasi invoice benar sebelum membuka aplikasi.",
    tags: ["scan invoice", "RIL", "gudang", "barang masuk"],
  },
];

export async function seedHubKnowledgeIfEmpty() {
  const updateCount = await HubUpdate.countDocuments();
  if (updateCount === 0) {
    const updates = readJson("updates.json", []);
    if (updates.length) {
      await HubUpdate.insertMany(
        updates.map((item) => ({
          projectSlug: item.projectSlug || slugify(item.projectTitle),
          projectTitle: item.projectTitle,
          projectMatched: item.projectMatched !== false,
          task: item.task,
          status: item.status || "pending",
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
          completedBy: item.completedBy || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
        })),
      );
      console.log(`Seed HubUpdate: ${updates.length} rows`);
    }
  }

  const howtoVisibility = await HubKnowledgeDoc.updateMany(
    {
      docType: "howto",
      $or: [{ visibility: { $exists: false } }, { visibility: null }],
    },
    { $set: { visibility: "public" } },
  );
  const technicalVisibility = await HubKnowledgeDoc.updateMany(
    {
      docType: "technical",
      $or: [{ visibility: { $exists: false } }, { visibility: null }],
    },
    { $set: { visibility: "internal" } },
  );
  const visibilityUpdates =
    (howtoVisibility.modifiedCount || 0) +
    (technicalVisibility.modifiedCount || 0);
  if (visibilityUpdates) {
    console.log(`HubKnowledgeDoc visibility backfill: ${visibilityUpdates}`);
  }

  const guideOperations = INTERNAL_GUIDES.map((guide) => ({
    updateOne: {
      filter: { slug: guide.slug },
      update: {
        $setOnInsert: {
          ...guide,
          docType: "howto",
          visibility: "internal",
          source: "system-hub",
        },
      },
      upsert: true,
    },
  }));
  if (guideOperations.length) {
    await HubKnowledgeDoc.bulkWrite(guideOperations, { ordered: false });
  }
}

// CLI: node utils/seedHubKnowledge.js
const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  await connectDB();
  await seedHubKnowledgeIfEmpty();
  await mongoose.disconnect();
  process.exit(0);
}
