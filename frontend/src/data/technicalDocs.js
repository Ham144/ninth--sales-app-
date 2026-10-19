export const technicalDocs = [
  {
    id: "x-api-key",
    title: "Cara pakai x-api-key",
    body: [
      "Backend MIDCSI mengekspos endpoint SOT lewat header `x-api-key`.",
      "Key digenerate di halaman x-api-key (role IT). Format contoh: `CSIOPEN_<hex>`.",
      "Kirim header `x-api-key: <nilai>` pada request backend-to-backend. Jangan taruh key di frontend publik.",
      "Endpoint contoh: `/api/v1/sot/user`, `/api/v1/sot/organization`.",
    ],
  },
  {
    id: "voucher",
    title: "Konsep voucher",
    body: [
      "Voucher adalah nilai potongan/benefit yang punya masa berlaku, kuota, dan aturan pemakaian per channel.",
      "Validasi biasanya terjadi sebelum sales line final: cek aktif, expired, limit, dan kompatibilitas item/customer.",
      "Catat pemakaian voucher di transaksi supaya recon dan audit tetap bisa dilacak.",
    ],
  },
  {
    id: "diskon",
    title: "Konsep diskon",
    body: [
      "Diskon di ekosistem CSI mengikuti customer price group / brand rules, bukan angka bebas di UI.",
      "Urutan umum: harga dasar → group price → diskon tambahan (jika ada) → total.",
      "Jangan campur logika diskon channel (web/OS/MP/JD) tanpa mapping field yang jelas di product library.",
    ],
  },
  {
    id: "mobile-pos-sync",
    title: "Sinkronisasi mobile POS",
    body: [
      "POS mobile menyimpan draft lokal lalu sync ke backend saat online.",
      "Konflik biasanya diselesaikan dengan timestamp / status dokumen; jangan overwrite status released dari NAV.",
      "Pastikan master product/customer yang dipakai POS berasal dari library pusat agar harga konsisten.",
    ],
  },
  {
    id: "warehouse-queue",
    title: "Socket warehouse queue management",
    body: [
      "Antrian gudang memakai socket agar status lane/counter realtime antar device.",
      "Event penting: join queue, call next, skip, done, reconnect recovery.",
      "Server harus idempotent pada event yang di-retry client setelah putus koneksi.",
    ],
  },
];
