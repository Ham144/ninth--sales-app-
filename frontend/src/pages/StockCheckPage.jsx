import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProductApi from "@/api/productApi";
import { Toaster } from "sonner";
import locationApi from "@/api/LocationApi";
import ProductItem from "@/components/ProductItem";
import { Search, SearchCheckIcon } from "lucide-react";

const StockCheckPage = () => {
  const [locationCode, setLocationCode] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  //get  all location to fill dim1 and  location code
  const { data: locationList } = useQuery({
    queryKey: ["location"],
    queryFn: async () => await locationApi.getAllLocation(),
  });

  const {
    data: productList,
    isLoading: isProductsLoading,
    isError: isProductsError,
    isFetching: isProductsFetching,
  } = useQuery({
    queryKey: ["products", searchKey, page, limit],
    queryFn: () => ProductApi.getAllProducts(searchKey, page, limit),
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  // Query untuk stok produk yang dipilih
  const {
    data: selectedProductData,
    isLoading: isStockLoading,
    isError: isStockError,
  } = useQuery({
    queryKey: ["selected-product-stock", selectedProduct?.No, locationCode],
    queryFn: () =>
      ProductApi.getStockByNo({
        No: selectedProduct.No,
        locationCode,
      }),
    enabled: !!selectedProduct?.No && !!locationCode,
  });

  useEffect(() => {
    setPage(1);
  }, [searchKey, limit]);

  const closeModal = () => {
    setSelectedProduct(null);
    document.getElementById("modal-check-stock").close();
  };

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    document.getElementById("modal-check-stock").showModal();
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return "-";
    const num = typeof value === "string" ? Number(value) : value;
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString("id-ID");
  };

  // Filter inventory fields that start with "Inv_"
  const getInventoryFields = (data) => {
    if (!data) return [];
    return Object.entries(data)
      .filter(([key, value]) =>
        key?.toString().toLowerCase().startsWith("inv_")
      )
      .map(([key, value]) => ({
        key: key.replace(/^inv_/i, ""),
        value: value,
      }));
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center py-6 px-4 max-md:pb-24">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />

      <Toaster position="top-center" />

      <div className="relative flex flex-col  max-md:flex-col-reverse w-full max-w-6xl bg-white/80 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden mt-8">
        {/* Header Section with your gradient */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
          {/* header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <SearchCheckIcon />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Check Stock</h1>
            </div>

            {/* Location Selector */}
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-indigo-100 mb-1">
                Pilih Lokasi
              </label>
              <div className="relative">
                <select
                  onChange={(e) => setLocationCode(e.target.value)}
                  value={locationCode || ""}
                  className="w-full px-4 py-2 pr-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white appearance-none cursor-pointer focus:ring-2 focus:ring-white focus:border-white"
                >
                  <option value="" className="text-gray-800">
                    Pilih Location
                  </option>
                  {locationList?.data?.length ? (
                    locationList?.data?.map((loc) => (
                      <option
                        key={loc.name}
                        value={loc.name}
                        className="text-gray-800"
                      >
                        {loc.name}
                      </option>
                    ))
                  ) : (
                    <option disabled value="" className="text-gray-800">
                      Tidak Ada Data
                    </option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-indigo-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search products..."
              className="pl-10 w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-indigo-200 focus:ring-2 focus:ring-white focus:border-white"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 md:p-6 flex flex-col max-md:flex-col-reverse ">
          {/* Products Table - Mobile Responsive */}
          <div className="rounded-xl shadow-md overflow-hidden md:mb-6 max-md:mt-2">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-indigo-100">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                      No
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider max-md:hidden">
                      Brand
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider max-md:hidden">
                      Category
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-indigo-100">
                  {isProductsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                          <span className="ml-3 text-indigo-700">
                            Loading products...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : isProductsError ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 inline mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Gagal memuat data produk.
                        </div>
                      </td>
                    </tr>
                  ) : productList?.data?.length ? (
                    productList.data.map((product) => (
                      <ProductItem
                        key={product._id}
                        product={product}
                        locationCode={locationCode}
                        handleProductClick={handleProductClick}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center">
                        <div className="text-indigo-700 flex flex-col items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 mb-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <p>Tidak ada data produk.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-indigo-50 p-4 rounded-xl">
            <div className="text-sm text-indigo-700">
              {(() => {
                const total = productList?.total ?? 0;
                const start = total === 0 ? 0 : (page - 1) * limit + 1;
                const end = Math.min(page * limit, total);
                return (
                  <span>
                    Menampilkan {start}-{end} dari {total} produk
                    {isProductsFetching && (
                      <span className="ml-2 inline-block">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600"></div>
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative">
                <select
                  className="py-2 pl-3 pr-10 bg-white border border-indigo-300 rounded-lg text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-indigo-800"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  <option value={10}>10 / halaman</option>
                  <option value={20}>20 / halaman</option>
                  <option value={50}>50 / halaman</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                  <svg
                    className="h-4 w-4 text-indigo-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              {(() => {
                const totalPages = productList?.totalPages ?? 1;
                const currentPage = productList?.currentPage ?? page;
                const makeRange = (total, current) => {
                  const delta = 1;
                  const range = [];
                  const left = Math.max(1, current - delta);
                  const right = Math.min(total, current + delta);
                  for (let i = left; i <= right; i++) range.push(i);
                  if (left > 2) range.unshift("...");
                  if (left > 1) range.unshift(1);
                  if (right < total - 1) range.push("...");
                  if (right < total) range.push(total);
                  return range;
                };
                const pages = makeRange(totalPages, currentPage);
                const canPrev = currentPage > 1;
                const canNext = currentPage < totalPages;
                return (
                  <div className="flex items-center gap-1">
                    <button
                      className="p-2 rounded-lg bg-white border border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-700"
                      disabled={!canPrev}
                      onClick={() =>
                        canPrev && setPage((p) => Math.max(1, p - 1))
                      }
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
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    {pages.map((p, idx) =>
                      p === "..." ? (
                        <span
                          key={`dots-${idx}`}
                          className="px-2 py-1 text-indigo-700"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          className={`min-w-[2.5rem] px-2 py-1 rounded-lg text-sm ${
                            p === currentPage
                              ? "bg-indigo-600 text-white"
                              : "bg-white border border-indigo-300 text-indigo-700"
                          }`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      className="p-2 rounded-lg bg-white border border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-700"
                      disabled={!canNext}
                      onClick={() =>
                        canNext && setPage((p) => Math.min(totalPages, p + 1))
                      }
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Modal */}
      <dialog id="modal-check-stock" className="modal">
        <div className="modal-box w-11/12 max-w-4xl p-0 overflow-hidden">
          {selectedProduct && (
            <>
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-2xl">Stock Information</h3>
                  <button
                    onClick={closeModal}
                    className="btn btn-sm btn-circle btn-ghost text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Product Info Card */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <h4 className="font-semibold text-indigo-800 mb-2">
                        Product Details
                      </h4>
                      <p className="text-lg font-bold text-indigo-900 mb-1">
                        {selectedProduct.Description}
                      </p>
                      <p className="text-sm text-indigo-700 mb-1">
                        {selectedProduct.Description_2}
                      </p>
                      <p className="text-sm text-indigo-700">
                        No: {selectedProduct.No}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-800 mb-2">
                        Pricing
                      </h4>
                      <div className="space-y-1">
                        <p className="text-sm text-indigo-700">
                          Web: Rp {selectedProduct.Web?.toLocaleString("id-ID")}
                        </p>
                        <p className="text-sm text-indigo-700">
                          Retail: Rp{" "}
                          {selectedProduct.Retail?.toLocaleString("id-ID")}
                        </p>
                        <p className="text-sm text-indigo-700">
                          Dealer: Rp{" "}
                          {selectedProduct.Dealer?.toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory Table */}
                {isStockLoading && (
                  <div className="flex items-center justify-center gap-3 text-indigo-700 py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span>Loading inventory...</span>
                  </div>
                )}
                {isStockError && (
                  <div className="alert alert-error bg-red-50 text-red-700 p-4 rounded-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Gagal memuat data stok. Coba lagi.
                  </div>
                )}
                {selectedProductData?.data && (
                  <div>
                    <h4 className="font-semibold text-lg text-indigo-800 mb-4">
                      Inventory Levels
                    </h4>
                    {(() => {
                      const stockEntity = Array.isArray(
                        selectedProductData.data
                      )
                        ? selectedProductData.data[0]
                        : selectedProductData.data;
                      const inv = getInventoryFields(stockEntity);
                      if (!inv.length) {
                        return (
                          <div className="text-sm text-indigo-700 py-4 text-center">
                            Tidak ada data inventory.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {inv.map(({ key, value }) => (
                            <div
                              key={key}
                              className="bg-white border border-indigo-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                            >
                              <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
                                {key.replace(/_/g, " ")}
                              </div>
                              <div className="text-xl font-bold text-indigo-900">
                                {value || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="modal-action mt-8">
                  <button
                    onClick={closeModal}
                    className="btn bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6"
                  >
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
};

export default StockCheckPage;
