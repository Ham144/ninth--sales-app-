/**
 * Format angka menjadi format mata uang Rupiah (IDR)
 * @param {number} amount - Angka yang akan diformat
 * @returns {string} - String berformat mata uang
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return "Rp 0";

  // Konversi ke number jika string
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  // Format dengan Intl.NumberFormat
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
};
