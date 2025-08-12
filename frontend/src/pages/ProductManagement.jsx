import ProductApi from "@/api/productApi";
import PengelolaSideBarMenu from "@/components/PengelolasSideBarMenu";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

const ProductManagement = () => {
  const [searchKey, setSearchKey] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

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

  useEffect(() => {
    setPage(1);
  }, [searchKey, limit]);

  const {
    data: selectedProductData,
    isLoading: isStockLoading,
    isError: isStockError,
  } = useQuery({
    queryKey: ["product", selectedProduct?.No],
    queryFn: () => ProductApi.getStockByNo(selectedProduct?.No),
    enabled: !!selectedProduct,
    refetchOnWindowFocus: false,
  });

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    document.getElementById("modal-check-stock").showModal();
  };

  const closeModal = () => {
    setSelectedProduct(null);
    document.getElementById("modal-check-stock").close();
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
    <PengelolaSideBarMenu>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-light text-gray-800 mb-6">
            Product Management
          </h2>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="form-control rounded-md  w-full max-w-md">
              <input
                type="text"
                placeholder="Search products..."
                className="input input-bordered rounded-md w-full"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* Products Table */}
        <div className="backdrop rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table  w-full">
              <thead className="">
                <tr>
                  <th className="text-gray-700 font-semibold">No</th>
                  <th className="text-gray-700 font-semibold">Description</th>
                  <th className="text-gray-700 font-semibold">Brand</th>
                  <th className="text-gray-700 font-semibold">Category</th>
                  <th className="text-gray-700 font-semibold">Web Price</th>
                </tr>
              </thead>
              <tbody>
                {isProductsLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      <span className="loading loading-spinner loading-md mr-2" />
                      Loading products...
                    </td>
                  </tr>
                ) : isProductsError ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-error">
                      Gagal memuat data produk.
                    </td>
                  </tr>
                ) : productList?.data?.length ? (
                  productList.data.map((product) => (
                    <tr
                      key={product._id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleProductClick(product)}
                    >
                      <td className="font-mono text-sm">{product.No}</td>
                      <td>
                        <div>
                          <div className="font-medium text-gray-900">
                            {product.Description}
                          </div>
                          <div className="text-sm text-gray-500">
                            {product.Description_2}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline badge-primary">
                          {product._x003C_Brand_x003E_ ||
                            product.Manufacturer_Code ||
                            "-"}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-outline badge-secondary">
                          {product.Item_Category_Code}
                        </span>
                      </td>
                      <td className="font-mono">
                        Rp {formatCurrency(product.Web)}
                      </td>
                      <td>
                        {product.Blocked === "true" ? (
                          <span className="badge badge-error rounded-md text-white">
                            Blocked
                          </span>
                        ) : (
                          <span className="badge text-white bg-green-500 rounded-md">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-sm text-gray-500 py-6"
                    >
                      Tidak ada data produk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {(() => {
              const total = productList?.total ?? 0;
              const start = total === 0 ? 0 : (page - 1) * limit + 1;
              const end = Math.min(page * limit, total);
              return (
                <span>
                  Menampilkan {start}-{end} dari {total} produk
                  {isProductsFetching ? (
                    <span className="ml-2 loading loading-dots loading-xs align-middle" />
                  ) : null}
                </span>
              );
            })()}
          </div>

          <div className="flex items-center gap-3">
            <select
              className="select select-bordered select-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={10}>10 / halaman</option>
              <option value={20}>20 / halaman</option>
              <option value={50}>50 / halaman</option>
            </select>

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
                <div className="join">
                  <button
                    className="join-item btn btn-sm"
                    disabled={!canPrev}
                    onClick={() =>
                      canPrev && setPage((p) => Math.max(1, p - 1))
                    }
                  >
                    «
                  </button>
                  {pages.map((p, idx) =>
                    p === "..." ? (
                      <button
                        key={`dots-${idx}`}
                        className="join-item btn btn-sm btn-ghost"
                        disabled
                      >
                        ...
                      </button>
                    ) : (
                      <button
                        key={p}
                        className={`join-item btn btn-sm ${
                          p === currentPage ? "btn-active" : ""
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    className="join-item btn btn-sm"
                    disabled={!canNext}
                    onClick={() =>
                      canNext && setPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    »
                  </button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Stock Modal */}
        <dialog id="modal-check-stock" className="modal">
          <div className="modal-box w-11/12 max-w-4xl">
            {selectedProduct && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-2xl text-gray-800">
                    Stock Information
                  </h3>
                  <button
                    onClick={closeModal}
                    className="btn btn-sm btn-circle btn-ghost"
                  >
                    ✕
                  </button>
                </div>

                {/* Product Info Card */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-700">
                        Product Details
                      </h4>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedProduct.Description}
                      </p>
                      <p className="text-sm text-gray-600">
                        {selectedProduct.Description_2}
                      </p>
                      <p className="text-sm text-gray-600">
                        No: {selectedProduct.No}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-700">Pricing</h4>
                      <p className="text-sm text-gray-600">
                        Web: Rp {selectedProduct.Web?.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Retail: Rp {selectedProduct.Retail?.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Dealer: Rp {selectedProduct.Dealer?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Inventory Table */}
                {isStockLoading && (
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className="loading loading-spinner loading-md" />
                    <span>Loading inventory...</span>
                  </div>
                )}
                {isStockError && (
                  <div className="alert alert-error text-sm">
                    Gagal memuat data stok. Coba lagi.
                  </div>
                )}
                {selectedProductData?.data && (
                  <div>
                    <h4 className="font-semibold text-lg text-gray-700 mb-4">
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
                          <div className="text-sm text-gray-500">
                            Tidak ada data inventory.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {inv.map(({ key, value }) => (
                            <div
                              key={key}
                              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                            >
                              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {key.replace(/_/g, " ")}
                              </div>
                              <div className="text-lg font-bold text-gray-900 mt-1">
                                {value || 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="modal-action mt-6">
                  <button onClick={closeModal} className="btn btn-primary">
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      </div>
    </PengelolaSideBarMenu>
  );
};

export default ProductManagement;
