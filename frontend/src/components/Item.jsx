import ProductApi from "@/api/productApi";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Button } from "./ui/button";
import { Minus, Plus, Trash } from "lucide-react";
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
    <div key={prod.No} className=" ">
      {/* Product Information Section */}
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {prod.Description}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            SKU: {prod.No}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-800/50">
          <p className="text-green-700 dark:text-green-300 font-bold text-base">
            Harga: Rp {Intl.NumberFormat("id-ID").format(prod.price)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Stok: {stockData?.stockResult || 0}
            </span>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 italic hidden md:block">
            (menyesuaikan dengan lokasi yang dipilih)
          </div>
        </div>

        {!selectedLocationCode && (
          <div className="flex items-center gap-1.5 mt-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-amber-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Pilih lokasi untuk melihat stok yang tersedia
            </span>
          </div>
        )}
      </div>

      {/* Quantity Control Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col justify-center">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newQty = prod.qty - 1;
                if (newQty >= 0) {
                  updateProductQty(newQty);
                }
              }}
              disabled={prod.qty <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className="w-16 h-9 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-center font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={prod.qty}
                min="0"
                max={stockData?.stockResult || 999999}
                onChange={(e) => {
                  const newQty = parseInt(e.target.value, 10) || 0;
                  const maxStock = stockData?.stockResult || 999999;

                  if (newQty > maxStock) {
                    toast.error(
                      `Quantity tidak boleh melebihi stok yang tersedia (${maxStock})`
                    );
                    return;
                  }

                  setManualQty(newQty);
                }}
              />
            </div>

            <button
              onClick={() => {
                const newQty = prod.qty + 1;
                const maxStock = stockData?.stockResult || 999999;

                if (newQty > maxStock) {
                  toast.error(
                    `Quantity tidak boleh melebihi stok yang tersedia (${maxStock})`
                  );
                  return;
                }

                updateProductQty(prod.No, 1);
              }}
              disabled={
                stockData?.stockResult !== undefined &&
                prod.qty >= stockData.stockResult
              }
              className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            onClick={() => removeProduct(prod.No)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>

        {/* Stock Info for Mobile */}
        <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-2 text-center md:hidden">
          (menyesuaikan dengan lokasi yang dipilih)
        </div>
      </div>
    </div>
  );
};

export default Item;
