import xml2js from "xml2js";
import { checkStatusSONAVXml } from "../xml.js";
import { fetchData } from "./soap-util.js";
import {
  getMissingConfigFields,
  SOAP_CHECKSTATUSNAV_CONFIG_FIELDS,
} from "./orgConfigFields.js";

const CACHE_SECONDS = 3 * 60 * 60;
const NAV_FIELDS = [
  "Pick_Ticket_No",
  "No",
  "Do_No",
  "CI_No",
  "SI_NO",
  "Qty_Picked",
  "Item_No",
];

function cleanRow(row) {
  return Object.fromEntries(
    NAV_FIELDS.map((field) => [field, row?.[field] ?? null]).filter(([, value]) => value !== null),
  );
}

export async function readSalesOrderNavStatus({ returnValue, org, redis }) {
  const value = String(returnValue || "").trim();
  if (!value) {
    const error = new Error("return_value harus diisi");
    error.status = 400;
    throw error;
  }
  if (!org) {
    const error = new Error("Organisasi tidak ditemukan");
    error.status = 404;
    throw error;
  }
  const missingFields = getMissingConfigFields(org, SOAP_CHECKSTATUSNAV_CONFIG_FIELDS);
  if (missingFields.length) {
    const error = new Error("Konfigurasi SOAP CHECKSTATUSNAV tidak lengkap");
    error.status = 500;
    error.missingFields = missingFields;
    throw error;
  }

  const cacheKey = `sales-order-nav:${value}`;
  try {
    const cached = await redis?.get(cacheKey);
    if (cached) {
      return {
        data: JSON.parse(cached),
        source: "cache",
        cacheMaxAgeHours: 3,
      };
    }
  } catch {
    // Cache tidak wajib. Lanjut ke NAV.
  }

  const raw = await fetchData({
    xml: checkStatusSONAVXml({
      return_value: value,
      xmlns: org.SOAP_CHECKSTATUSNAV_XMLNS,
    }),
    username: org.SOAP_CHECKSTATUSNAV_USERNAME,
    password: org.SOAP_CHECKSTATUSNAV_PASSWORD,
    url: org.SOAP_CHECKSTATUSNAV_URL,
    SOAPAction: org.SOAP_CHECKSTATUSNAV_SOAPACTION,
  });
  if (!raw) {
    const error = new Error("Response kosong dari NAV");
    error.status = 502;
    throw error;
  }

  let parsed;
  try {
    parsed = await xml2js.parseStringPromise(raw, {
      explicitArray: false,
      trim: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
    });
  } catch (cause) {
    const error = new Error(`Gagal parse XML response: ${cause?.message || cause}`);
    error.status = 502;
    throw error;
  }
  const fault = parsed?.Envelope?.Body?.Fault;
  if (fault) {
    const error = new Error(fault?.faultstring || "SOAP Fault tanpa pesan");
    error.status = 502;
    error.code = fault?.faultcode || null;
    throw error;
  }

  const result = parsed?.Envelope?.Body?.ReadMultiple_Result?.ReadMultiple_Result;
  const rawRows = Array.isArray(result?.SOAPI) ? result.SOAPI : result?.SOAPI ? [result.SOAPI] : [];
  const data = rawRows.map(cleanRow);
  try {
    if (data.length) await redis?.set(cacheKey, JSON.stringify(data), "EX", CACHE_SECONDS);
  } catch {
    // Cache tidak wajib.
  }
  return {
    data,
    source: "live",
    cacheMaxAgeHours: 3,
    note: data.length
      ? "NAV mengembalikan dokumen picking/pengiriman. SOAP ini tidak memiliki field resi kurir."
      : "Belum ada data untuk order tersebut di NAV.",
  };
}

