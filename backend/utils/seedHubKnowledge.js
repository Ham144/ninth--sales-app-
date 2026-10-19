import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import HubUpdate from "../models/HubUpdate.model.js";
import HubKnowledgeDoc from "../models/HubKnowledgeDoc.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendData = path.resolve(__dirname, "../../frontend/src/data");

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(frontendData, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

const TECHNICAL_SEED = [
  {
    slug: "x-api-key",
    title: "Cara pakai x-api-key",
    tags: ["api", "integration", "security"],
    content: [
      "Backend MIDCSI mengekspos endpoint SOT lewat header x-api-key.",
      "Key digenerate di halaman x-api-key (role IT). Format contoh: CSIOPEN_<hex>.",
      "Kirim header x-api-key: <nilai> pada request backend-to-backend. Jangan taruh key di frontend publik.",
      "Endpoint contoh: /api/v1/sot/user, /api/v1/sot/organization.",
    ].join("\n\n"),
  },
  {
    slug: "voucher",
    title: "Konsep voucher",
    tags: ["voucher", "pricing"],
    content: [
      "Voucher adalah nilai potongan/benefit yang punya masa berlaku, kuota, dan aturan pemakaian per channel.",
      "Validasi biasanya terjadi sebelum sales line final: cek aktif, expired, limit, dan kompatibilitas item/customer.",
      "Catat pemakaian voucher di transaksi supaya recon dan audit tetap bisa dilacak.",
    ].join("\n\n"),
  },
  {
    slug: "diskon",
    title: "Konsep diskon",
    tags: ["diskon", "pricing"],
    content: [
      "Diskon di ekosistem CSI mengikuti customer price group / brand rules, bukan angka bebas di UI.",
      "Urutan umum: harga dasar → group price → diskon tambahan (jika ada) → total.",
      "Jangan campur logika diskon channel (web/OS/MP/JD) tanpa mapping field yang jelas di product library.",
    ].join("\n\n"),
  },
  {
    slug: "mobile-pos-sync",
    title: "Sinkronisasi mobile POS",
    tags: ["pos", "sync", "mobile"],
    content: [
      "POS mobile menyimpan draft lokal lalu sync ke backend saat online.",
      "Konflik biasanya diselesaikan dengan timestamp / status dokumen; jangan overwrite status released dari NAV.",
      "Pastikan master product/customer yang dipakai POS berasal dari library pusat agar harga konsisten.",
    ].join("\n\n"),
  },
  {
    slug: "warehouse-queue",
    title: "Socket warehouse queue management",
    tags: ["warehouse", "socket", "queue"],
    content: [
      "Antrian gudang memakai socket agar status lane/counter realtime antar device.",
      "Event penting: join queue, call next, skip, done, reconnect recovery.",
      "Server harus idempotent pada event yang di-retry client setelah putus koneksi.",
    ].join("\n\n"),
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

  const howtoCount = await HubKnowledgeDoc.countDocuments({ docType: "howto" });
  if (howtoCount === 0) {
    const projects = readJson("projects.json", []);
    const docs = projects.map((project) => {
      const featureLines = (project.features || [])
        .map((f) => `- ${f.name}: ${f.description || ""}`)
        .join("\n");
      return {
        docType: "howto",
        slug: `howto-${slugify(project.title)}-${project.id.slice(0, 8)}`,
        title: project.title,
        appId: project.id,
        appTitle: project.title,
        stage: project.stage || null,
        appUrl: project.url || null,
        summary: project.description || "",
        content: [
          project.description || "",
          project.url ? `URL: ${project.url}` : "",
          featureLines ? `Fitur utama:\n${featureLines}` : "",
          (project.technologies || []).length
            ? `Teknologi: ${(project.technologies || []).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        tags: ["howto", project.stage].filter(Boolean),
        technologies: project.technologies || [],
        features: project.features || [],
        source: "projects.json",
      };
    });
    if (docs.length) {
      await HubKnowledgeDoc.insertMany(docs);
      console.log(`Seed HubKnowledgeDoc howto: ${docs.length} rows`);
    }
  }

  const techCount = await HubKnowledgeDoc.countDocuments({
    docType: "technical",
  });
  if (techCount === 0) {
    await HubKnowledgeDoc.insertMany(
      TECHNICAL_SEED.map((doc) => ({
        docType: "technical",
        slug: `technical-${doc.slug}`,
        title: doc.title,
        summary: doc.title,
        content: doc.content,
        tags: ["technical", ...(doc.tags || [])],
        source: "technical-seed",
      })),
    );
    console.log(`Seed HubKnowledgeDoc technical: ${TECHNICAL_SEED.length} rows`);
  }
}
