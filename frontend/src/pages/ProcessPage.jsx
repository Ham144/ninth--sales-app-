"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import SalesOrderApi from "@/api/SalesOrderApi";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { placeHolderSearchSalesOrder } from "@/api/constant";
import { toast } from "sonner";
import { useUserInfo } from "@/store";
import { useNavigate } from "react-router";

export function ProcessPage() {
  const [active, setActive] = useState(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const ref = useRef(null);
  const id = useId();

  const [page, setPage] = useState(1);

  const { userInfo } = useUserInfo();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const {
    data: salesOrderList,
    isLoading: isLoadingList,
    refetch: refetchSalesOrder,
  } = useQuery({
    queryKey: ["salesOrders", search], // ✅ search dimasukkan agar query auto update
    queryFn: async () => await SalesOrderApi.getAllSalesOrder(search),
  });
  const totalPage = salesOrderList?.totalPage;

  // detail order
  const { data: salesOrderDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["salesOrderDetail", selectedSalesOrder?._id],
    queryFn: async () => await SalesOrderApi.getById(selectedSalesOrder._id),
    enabled: !!selectedSalesOrder,
  });

  // tombol clear search
  const handleClearSearch = () => {
    setSearch("");
    refetchSalesOrder(); // optional, karena queryKey sudah berubah
  };

  const { data: statusNAV, isLoading: isLoadingStatusNAV } = useQuery({
    queryKey: ["statusNAV", selectedSalesOrder?.return_value],
    queryFn: async () =>
      await SalesOrderApi.getStatusNav(selectedSalesOrder?.return_value),
    enabled: !!selectedSalesOrder?.return_value,
  });

  const getStatusNavByNo = (no) => {
    if (!statusNAV?.data || !Array.isArray(statusNAV?.data)) return null;
    return statusNAV?.data.find((item) => item.Item_No === no);
  };

  useEffect(() => {
    if (userInfo?.description === "OVERDUE") {
      navigate("/not-found");
    }
  }, [userInfo?.description]);

  return (
    <div className="flex items-center flex-col mx-auto container min-h-screen justify-center  ">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim().length === 0) {
            toast.error("Kolom pencarian tidak boleh kosong");
            return;
          }
          refetchSalesOrder();
        }}
        className="flex items-center  gap-2 relative w-full max-w-md"
      >
        {/* Input dengan tombol clear di dalamnya */}
        <div className="relative flex-1 max-md:px-4">
          <PlaceholdersAndVanishInput
            placeholders={placeHolderSearchSalesOrder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-16" // kasih padding kanan supaya tombol clear nggak nutup teks
          />

          {search.length > 0 && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 px-3 py-1 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* Background Overlay */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-10"
          />
        )}
      </AnimatePresence>

      {/* Popup Detail */}
      <AnimatePresence>
        {active && (
          <div className="fixed  inset-0 grid place-items-center z-[100]">
            <motion.div
              ref={ref}
              layoutId={`card-${active._id}-${id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl backdrop-blur-lg bg-white/50 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-200">
                <h3 className="font-bold text-2xl">Sales Order Detail</h3>
                <button
                  onClick={() => setActive(null)}
                  className="text-gray-500 hover:text-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {isLoadingDetail ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : salesOrderDetail?.data ? (
                <div className="p-4 space-y-6">
                  <div>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Return Value:</strong>
                      <span className="text-lg">
                        {salesOrderDetail?.data.return_value}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Document No:</strong>
                      <span className="text-lg">
                        {salesOrderDetail?.data.DocumentNo}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Customer :</strong>
                      <span className="text-lg">
                        {salesOrderDetail.data?.customer?.Name}{" "}
                        {salesOrderDetail.data?.customer?.No}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Order Date:</strong>
                      <span className="text-lg">
                        {new Date(
                          salesOrderDetail.data.OrderDate
                        ).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">
                        Ext doc (username):
                      </strong>
                      <span className="text-lg">
                        {salesOrderDetail?.data?.ExtDoc}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">
                        Request Delivery Date:
                      </strong>
                      <span className="text-lg">
                        {new Date(
                          salesOrderDetail.data.RequestDeliveryDate
                        ).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Location Code:</strong>
                      <span className="text-lg">
                        {salesOrderDetail.data.LocationCode}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">
                        Sales Person Code:
                      </strong>
                      <span className="text-lg">
                        {salesOrderDetail.data.SalespersonCode}
                      </span>
                    </p>{" "}
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Keterangan:</strong>
                      <span className="text-lg">
                        {salesOrderDetail.data.Keterangan}
                      </span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <strong className="font-semibold">Dim1 (Area):</strong>
                      <span className="text-lg">
                        {salesOrderDetail.data.Dim1}
                      </span>
                    </p>
                    {/* Section untuk SOAPI Data */}
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <h4 className="font-semibold mb-2">Sales Lines</h4>
                    {isLoadingStatusNAV && (
                      <span className="loading loading-ring loading-lg"></span>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left">Item No</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right ">Unit Price</th>
                            <th className="p-2 text-right max-md:hidden">
                              Qty_Picked
                            </th>
                            <th className="p-2 text-right max-md:hidden">
                              Pick_Ticket_No
                            </th>
                            <th className="p-2 text-right max-md:hidden">
                              Do_No
                            </th>
                            <th className="p-2 text-right max-md:hidden">
                              CI_No
                            </th>
                            <th className="p-2 text-right max-md:hidden">
                              SI_NO
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesOrderDetail?.data?.SalesLine.map((line) => (
                            <tr key={line.LineNo} className="border-t">
                              <td className="p-2">{line.ItemNo}</td>
                              <td className="p-2 text-right">{line.Qty}</td>
                              <td className="p-2 text-right">
                                {line.UnitPrice.toLocaleString()}
                              </td>
                              <td className="p-2 text-right max-md:hidden">
                                {getStatusNavByNo(line.ItemNo)?.Qty_Picked ||
                                  "-"}
                              </td>
                              <td className="p-2 text-right max-md:hidden">
                                {getStatusNavByNo(line.ItemNo)
                                  ?.Pick_Ticket_No || "-"}
                              </td>
                              <td className="p-2 text-right max-md:hidden">
                                {getStatusNavByNo(line.ItemNo)?.Do_No || "-"}
                              </td>
                              <td className="p-2 text-right max-md:hidden">
                                {getStatusNavByNo(line.ItemNo)?.CI_No || "-"}
                              </td>
                              <td className="p-2 text-right max-md:hidden">
                                {getStatusNavByNo(line.ItemNo)?.SI_NO || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">No Data</div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sales Order List */}
      <ul className="max-w-2xl  md:h-[60vh] max-md:h-[70vh] max-md:px-3  overflow-y-auto gap-y-4 flex flex-col mx-auto w-full gap-4 mt-6">
        {isLoadingList ? (
          <div className="flex justify-center items-center">
            <span className="loading loading-ring loading-lg"></span>
          </div>
        ) : (
          salesOrderList.data?.map((so) => (
            <li
              key={so._id}
              onClick={() => {
                setSelectedSalesOrder(so);
                setActive(so);
              }}
              className="p-4 flex justify-between items-center backdrop-blur-lg bg-white/50 border rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex flex-col w-full">
                <p className="font-semibold text-gray-800">{so.return_value}</p>

                <div className="flex justify-between mt-1">
                  <p className="text-sm text-gray-600">{so.DocumentNo}</p>

                  <div className="flex flex-col items-end">
                    <p className="text-sm text-gray-700 ">
                      {so.customer?.Name ?? "-"}
                    </p>
                    <p className="text-sm text-gray-700">
                      Rp{" "}
                      {Intl.NumberFormat("id-ID").format(so.SalesLineTotal) ??
                        "-"}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {so.RequestDeliveryDate
                    ? new Date(so.RequestDeliveryDate).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "-"}
                </p>
              </div>
              <span className="text-gray-400">›</span>
            </li>
          ))
        )}
      </ul>
      {/* pagination */}
      <div className="join grid grid-cols-3 rounded-xl shadow-lg overflow-hidden bg-gradient-to-r from-pink-50 to-pink-100 p-1 absolute bottom-[12%]">
        <button
          disabled={page === 1}
          onClick={() => page > 1 && setPage(page - 1)}
          className="join-item btn btn-outline disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-md border-pink-200 text-pink-700 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-800"
        >
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="max-md:hidden">Sebelumnya</span>
        </button>

        <div className="join-item flex items-center justify-center bg-white border border-pink-200 rounded-lg mx-1 shadow-sm">
          <span className="font-bold text-pink-700 text-lg">{page}</span>
          <span className="text-pink-400 mx-1">/</span>
          <span className="text-pink-500">{totalPage}</span>
        </div>

        <button
          disabled={page === totalPage}
          onClick={() => page < totalPage && setPage(page + 1)}
          className="join-item btn btn-outline disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-md border-pink-200 text-pink-700 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-800"
        >
          <span className="max-md:hidden">Selanjutnya</span>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 ml-2"
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
    </div>
  );
}

export default ProcessPage;
