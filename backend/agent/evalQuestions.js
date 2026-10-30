export const EVAL_QUESTIONS = [
  {
    id: "harga-web-tertinggi",
    message: "Produk dengan harga Web tertinggi secara keseluruhan",
    tools: ["search_products"],
  },
  {
    id: "piutang-terbesar",
    message: "Customer dengan piutang terbesar",
    tools: ["overdue_lookup"],
  },
  {
    id: "piutang-satu-customer",
    message: "Piutang customer 103057",
    tools: ["overdue_lookup"],
  },
  {
    id: "stok-tanpa-item",
    message: "Stok sebuah item di tiap lokasi, urutkan dari yang paling banyak",
    tools: [],
    forbid: ["stock_by_location", "search_products", "product_detail"],
  },
  {
    id: "nama-lokasi",
    message: "Sebutkan nama lokasi yang tersimpan di sistem",
    tools: ["list_locations"],
    forbidText: [/walk-in/i],
  },
  {
    id: "rekomendasi-aplikasi",
    message: "Saya staf gudang mau mencatat barang masuk dari invoice RIL, pakai aplikasi apa?",
    tools: ["hub_apps"],
  },
  {
    id: "buat-so",
    message: "dimana saya bisa buat so",
    tools: ["hub_apps"],
    requireText: [/s-bit/i],
    forbidText: [/nav mobile/i, /hub dashboard/i, /sales order app/i],
  },
  {
    id: "update-aplikasi",
    message: "Apa update terbaru aplikasi Catur POS?",
    tools: ["hub_apps"],
  },
  {
    id: "panduan-cek-stok",
    message: "Cari panduan internal tentang cara cek stok",
    tools: ["search_knowledge"],
  },
  {
    id: "invoice-nomor",
    message: "tolong cek invoice ini CSI-2026-00110",
    tools: ["sales_orders"],
  },
  {
    id: "status-nav-live",
    message: "Cek status NAV live order SO/SMD-25/08-00027",
    tools: ["sales_orders"],
  },
];

function normalizeNumber(token) {
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(token)) {
    const [whole, frac = ""] = token.replace(/\./g, "").split(",");
    return frac ? `${whole}.${frac}` : whole;
  }
  if (token.includes(",")) {
    const [whole, frac] = token.split(",");
    return `${whole}.${frac}`;
  }
  return token;
}

export function significantNumbers(text) {
  const found = [];
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{4,}(?:,\d+)?/g;
  for (const match of String(text || "").matchAll(re)) found.push(normalizeNumber(match[0]));
  return found;
}

function payloadNumbers(payloads) {
  const set = new Set(significantNumbers((payloads || []).join("\n")));
  for (const payload of payloads || []) {
    for (const raw of String(payload).match(/-?\d+(?:\.\d+)?/g) || []) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const whole = String(Math.trunc(Math.abs(value)));
      if (whole.length >= 4) set.add(whole);
      const printed = String(Math.abs(value));
      if (printed.length >= 4) set.add(printed);
    }
  }
  return set;
}

export function judge(question, { reply, called, payloads }) {
  const names = called || [];
  for (const name of question.tools || []) {
    if (!names.includes(name)) return { ok: false, reason: `tool ${name} tidak dipanggil` };
  }
  for (const name of question.forbid || []) {
    if (names.includes(name)) return { ok: false, reason: `tool ${name} tidak boleh dipanggil` };
  }
  for (const pattern of question.forbidText || []) {
    if (pattern.test(reply || "")) return { ok: false, reason: `jawaban memuat ${pattern}` };
  }
  for (const pattern of question.requireText || []) {
    if (!pattern.test(reply || "")) return { ok: false, reason: `jawaban tidak memuat ${pattern}` };
  }
  const allowed = payloadNumbers(payloads);
  for (const number of significantNumbers(question.message)) allowed.add(number);
  const missing = significantNumbers(reply).filter((number) => !allowed.has(number));
  if (missing.length) return { ok: false, reason: `angka tidak ada di hasil tool: ${missing.join(", ")}` };
  return { ok: true, reason: "" };
}
