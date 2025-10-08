import ProductApi from "@/api/productApi";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
/**
 * Item component
 * @param {Object} prod - product object
 * @param {Function} updateProductQty - function to update product quantity
 * @param {Function} setManualQty - function to set manual quantity
 * @param {Function} removeProduct - function to remove product
 * @param {string} selectedLocationCode - selected location code
 */
const Item = ({
  prod,
  updateProductQty,
  setManualQty,
  removeProduct,
  selectedLocationCode,
}) => {
  //pengambilan stock berdasarkan
  const { data: stockData, isLoading: isStockLoading } = useQuery({
    queryKey: ["product", prod.No, selectedLocationCode || "no-location"],
    queryFn: () =>
      ProductApi.getStockByNo({
        No: prod.No,
        locationCode: selectedLocationCode,
      }),
    enabled: !!prod?.No,
  });

  if (isStockLoading)
    return (
      <div className="h-24 w-full flex justify-center items-center">
        <p>Loading...</p>
      </div>
    );

  return (
    <div
      key={prod.No}
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300"
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product Information Section */}
        <div className="flex-1 space-y-4">
          {/* Product Header */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
              {prod.Description}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
              SKU: {prod.No}
            </p>
          </div>

          {/* Price Display */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl px-4 py-3 border border-green-100 dark:border-green-800/30">
            <span className="text-green-600 dark:text-green-400 font-bold text-lg">
              Rp {Intl.NumberFormat("id-ID").format(prod.price)}
            </span>
          </div>

          {/* Stock Information */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800/30">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Stok: {stockData?.stockResult || 0}
              </span>
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500 hidden lg:block">
              • Menyesuaikan lokasi
            </div>
          </div>

          {/* Location Warning */}
          {!selectedLocationCode && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-800/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-amber-500 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                Pilih lokasi untuk melihat stok yang tersedia
              </span>
            </div>
          )}
        </div>

        {/* Quantity Control Section */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3">
            {/* Quantity Controls */}
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2">
              {/* Decrease Button */}
              <button
                onClick={() => {
                  const newQty = prod.qty - 1;
                  if (newQty >= 0) {
                    updateProductQty.length === 2
                      ? updateProductQty(prod.No, -1)
                      : updateProductQty(newQty);
                  }
                }}
                disabled={prod.qty <= 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
              </button>

              {/* Quantity Input */}
              <div className="relative">
                <input
                  type="number"
                  className="w-16 h-8 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 dark:text-white rounded-lg text-center font-medium text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  value={prod.qty}
                  min="0"
                  max={stockData?.stockResult || 999999}
                  onChange={(e) => {
                    const newQty = parseInt(e.target.value, 10) || 0;
                    const maxStock = stockData?.stockResult || 999999;

                    setManualQty.length === 2
                      ? setManualQty(prod.No, newQty)
                      : setManualQty(newQty);
                  }}
                />
              </div>

              {/* Increase Button */}
              <button
                onClick={() => {
                  const newQty = prod.qty + 1;
                  const maxStock = stockData?.stockResult || 999999;


                  updateProductQty.length === 2
                    ? updateProductQty(prod.No, 1)
                    : updateProductQty(newQty);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500 transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => {
                removeProduct.length === 1
                  ? removeProduct(prod.No)
                  : removeProduct();
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
              title="Hapus produk"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Mobile Stock Info */}
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center lg:hidden">
            • Menyesuaikan lokasi
          </div>
        </div>
      </div>
    </div>
  );
};

export default Item;
