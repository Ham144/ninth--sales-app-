if (import.meta.env.VITE_BACKEND_URL) {
  PROD_URL = import.meta.env.VITE_BACKEND_URL;
}

export const NODE_ENV =
  typeof window !== "undefined" &&
  window.location.hostname === "midcsi.muara.co.id"
    ? "production"
    : "development";

export let siteKeyCloudflare = "0x4AAAAAABm0ajGlobtbdIIR";

export const APP_NAME = "Sales Order CSI";
export const APP_DESC = "Sistem Pembuat Sales Order Untuk Sales";
export const NAMAPERUSAHAAN = "PT. Catur Sukses Internasional";

export const initialTempSourceData = {
  title: "",
  desc: "",
  keys: [],
};

export const placeHolderSearchSalesOrder = [
  "Cari berdasarkan DocumentNo",
  "Cari berdasarkan return_value",
  "Cari berdasarkan SalespersonCode",
  "Cari berdasarkan ExtDoc",
  "Cari berdasarkan SellToCustNo",
  "Cari berdasarkan CustomerName",
];

export const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
