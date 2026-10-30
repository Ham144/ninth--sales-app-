import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import HubApp from "../models/HubApp.model.js";
import { connectDB } from "./connectDB.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function resolveProjectsPath() {
  const candidates = [
    path.resolve(__dirname, "../data/projects.json"),
    path.resolve(__dirname, "../../frontend/src/data/projects.json"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

/** Apps that typically don't need a user login form */
const NO_AUTH_IDS = new Set([
  "n8n-email-formater",
  "n8n-penggunaan-app",
  "csi-hub",
]);

export const APP_ADVISOR_METADATA = {
  "invoice-csi": {
    capabilities: ["scan invoice CSI", "mencatat barang masuk gudang", "mencatat barang keluar gudang"],
    useCases: ["memproses pergerakan barang dari invoice organisasi CSI"],
    audiences: ["gudang"],
    keywords: ["invoice csi", "scan invoice", "barang masuk", "barang keluar", "gudang"],
    limitations: ["khusus dokumen organisasi CSI"],
  },
  "invoice-ril": {
    capabilities: ["scan invoice RIL", "mencatat barang masuk gudang", "mencatat barang keluar gudang"],
    useCases: ["memproses pergerakan barang dari invoice organisasi RIL"],
    audiences: ["gudang"],
    keywords: ["invoice ril", "scan invoice", "barang masuk", "barang keluar", "gudang"],
    limitations: ["khusus dokumen organisasi RIL"],
  },
  "catur-pos": {
    capabilities: ["point of sale", "transaksi penjualan", "promo", "diskon", "invoice outlet"],
    useCases: ["melayani transaksi penjualan di outlet", "mengelola promo dan diskon POS"],
    audiences: ["kasir", "outlet", "admin POS"],
    keywords: ["pos", "kasir", "outlet", "penjualan", "promo", "diskon"],
    updateAliases: ["pos", "catur point of sale"],
  },
  "csi-super-pos": {
    capabilities: ["point of sale"],
    useCases: ["melayani transaksi penjualan melalui CSI Super POS"],
    audiences: ["kasir", "outlet"],
    keywords: ["super pos", "kasir", "outlet", "penjualan"],
  },
  "service-log-ril": {
    capabilities: ["mencatat barang return RIL", "mencatat proses service RIL"],
    useCases: ["mencatat barang yang dikembalikan atau masuk proses service"],
    audiences: ["service", "gudang"],
    keywords: ["service ril", "return", "retur", "barang rusak", "perbaikan"],
  },
  "claim-service": {
    capabilities: ["mencatat dan memantau claim service"],
    useCases: ["menangani claim yang berkaitan dengan Service Log"],
    audiences: ["service"],
    keywords: ["claim", "klaim", "service", "garansi"],
  },
  "e-form": {
    capabilities: ["membuat form", "workflow approval", "melacak persetujuan"],
    useCases: ["mengajukan form yang membutuhkan persetujuan", "memantau status approval"],
    audiences: ["staf", "approver"],
    keywords: ["form", "approval", "persetujuan", "workflow", "pengajuan"],
  },
  "s-bit": {
    capabilities: ["membuat sales order", "membuat SO", "sales force automation"],
    useCases: ["membuat sales order (SO) untuk customer toko di aplikasi s-bit"],
    audiences: ["sales", "telesales"],
    keywords: ["s-bit", "sbit", "buat so", "buat sales order", "membuat so", "sales order", "so", "sfa"],
    limitations: ["satu-satunya aplikasi untuk membuat sales order baru"],
    updateAliases: ["s-bit"],
  },
  "petty-cash": {
    capabilities: ["mencatat kas kecil gudang", "memantau arus kas kecil"],
    useCases: ["mencatat pemasukan dan pengeluaran petty cash warehouse"],
    audiences: ["gudang", "kasir", "admin"],
    keywords: ["petty cash", "kas kecil", "cashflow", "pengeluaran", "warehouse"],
    updateAliases: ["petty-cash", "petty cash"],
  },
  antrian: {
    capabilities: ["mengelola antrian gudang"],
    useCases: ["melihat atau mengatur antrean layanan gudang"],
    audiences: ["gudang"],
    keywords: ["antrian", "antrean", "gudang", "jadwal"],
    updateAliases: ["fix antrian", "antrian gudang"],
  },
  "stok-opname": {
    capabilities: ["mencatat stok opname", "membandingkan hasil hitung stok"],
    useCases: ["melakukan dan memeriksa hasil stok opname gudang"],
    audiences: ["gudang", "inventory"],
    keywords: ["stok opname", "stock opname", "hitung stok", "selisih stok"],
    updateAliases: ["stok-opname", "stok opname"],
  },
  "bukti-scan": {
    capabilities: ["menyimpan bukti scan"],
    useCases: ["mengelola dokumen hasil scan CSI"],
    audiences: ["staf CSI"],
    keywords: ["bukti scan", "buktiscan", "dokumen scan", "arsip"],
    limitations: ["khusus Catur Sukses Internasional"],
    updateAliases: ["BuktiScan", "bukti-scan"],
  },
  "n8n-email-formater": {
    capabilities: ["format email", "format faktur melalui workflow"],
    useCases: ["menjalankan workflow formatting email atau faktur"],
    audiences: ["IT", "admin"],
    keywords: ["n8n", "email formatter", "faktur", "workflow"],
  },
  "n8n-penggunaan-app": {
    capabilities: ["merangkum penggunaan aplikasi"],
    useCases: ["melihat rangkuman penggunaan aplikasi"],
    audiences: ["IT", "admin"],
    keywords: ["n8n", "penggunaan aplikasi", "usage", "rangkuman"],
  },
  "csi-hub": {
    capabilities: ["melihat daftar aplikasi", "melihat dokumentasi sistem"],
    useCases: ["menemukan aplikasi dan informasi sistem CSI"],
    audiences: ["staf", "IT"],
    keywords: ["system hub", "project library", "daftar aplikasi", "dokumentasi"],
    updateAliases: ["project library", "csi hub"],
  },
  "midcsi-so": {
    capabilities: ["data produk", "data customer", "mencari status sales order yang sudah ada", "layanan SOAP", "otomasi internal"],
    useCases: ["mencari order yang sudah tersimpan dan status NAV"],
    audiences: ["staf", "IT", "telesales"],
    keywords: ["midcsi", "produk", "customer", "status order", "soap", "backend"],
    limitations: ["bukan tempat membuat sales order; SO baru dibuat di s-bit"],
  },
  midcsi: {
    capabilities: ["data produk", "data customer", "mencari status sales order yang sudah ada", "layanan SOAP", "otomasi internal"],
    useCases: ["mencari order yang sudah tersimpan dan status NAV"],
    audiences: ["staf", "IT", "telesales"],
    keywords: ["midcsi", "produk", "customer", "status order", "soap", "backend"],
    limitations: ["bukan tempat membuat sales order; SO baru dibuat di s-bit"],
  },
};

export async function seedHubAppsIfEmpty() {
  const count = await HubApp.countDocuments();
  let projects = [];
  const projectsPath = resolveProjectsPath();
  try {
    projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
  } catch (err) {
    console.warn("[seedHubApps] cannot read projects.json:", err.message);
    return { seeded: false, count: 0 };
  }

  if (count > 0) {
    const operations = Object.entries(APP_ADVISOR_METADATA).flatMap(([id, metadata]) =>
      Object.entries(metadata).map(([field, value]) => ({
        updateOne: {
          filter: {
            id,
            $or: [
              { [field]: { $exists: false } },
              Array.isArray(value) ? { [field]: { $size: 0 } } : { [field]: "" },
            ],
          },
          update: { $set: { [field]: value } },
        },
      })),
    );
    if (operations.length) await HubApp.bulkWrite(operations, { ordered: false });
    return { seeded: false, enriched: true, count };
  }

  const docs = projects.map((p, index) => ({
    id: p.id,
    title: p.title,
    description: p.description || "",
    url: p.url,
    iconUrl: p.iconUrl || null,
    authRequired: !NO_AUTH_IDS.has(p.id),
    sortOrder: index,
    active: true,
    ...(APP_ADVISOR_METADATA[p.id] || {}),
  }));

  if (!docs.length) return { seeded: false, count: 0 };
  await HubApp.insertMany(docs);
  console.log(`[seedHubApps] seeded ${docs.length} apps`);
  return { seeded: true, count: docs.length };
}

// CLI: node utils/seedHubApps.js
const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  await connectDB();
  const result = await seedHubAppsIfEmpty();
  console.log(result);
  await mongoose.disconnect();
  process.exit(0);
}
