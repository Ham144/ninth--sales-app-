const DEV_URL = "http://192.168.169.12:3000";
let PROD_URL = "http://192.168.169.22:3000";

if (import.meta.env.VITE_BACKEND_URL) {
  PROD_URL = import.meta.env.VITE_BACKEND_URL;
}

export let NODE_ENV = "development";
// export let NODE_ENV = "production";

if (import.meta.env.VITE_DEMO) {
  NODE_ENV = "production";
}
export const BASE_URL = NODE_ENV == "production" ? PROD_URL : DEV_URL;

export let siteKeyCloudflare =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "0x4AAAAAABm0ajGlobtbdIIR";

export const APP_NAME = "Sales APP";
export const APP_DESC = "Sistem request penjualan produk CSI";
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
];
