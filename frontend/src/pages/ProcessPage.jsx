"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { useMutation, useQuery } from "@tanstack/react-query";
import SalesOrderApi from "@/api/SalesOrderApi";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { placeHolderSearchSalesOrder } from "@/api/constant";
import { toast } from "sonner";

export function ProcessPage() {
  const [active, setActive] = useState(null);
  const [selectedSalesOrder, setSelectedSalesOrder] = useState(null);
  const ref = useRef(null);
  const id = useId();
  const [search, setSearch] = useState("");

  const { data: salesOrderList, isLoading: isLoadingList } = useQuery({
    queryKey: ["salesOrders"],
    queryFn: async () => await SalesOrderApi.getAllSalesOrder(),
  });

  const { data: salesOrderDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["salesOrderDetail", selectedSalesOrder?._id],
    queryFn: async () => await SalesOrderApi.getById(selectedSalesOrder._id),
    enabled: !!selectedSalesOrder,
  });

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setActive(null);
      }
    }
    document.body.style.overflow = active ? "hidden" : "auto";
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);
  useOutsideClick(ref, () => setActive(null));

  return (
    <div className="flex flex-col mx-auto container min-h-screen justify-center">
      <PlaceholdersAndVanishInput
        placeholders={placeHolderSearchSalesOrder}
        onChange={(e) => setSearch(e.target.value)}
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchSalesOrder();
        }}
      />
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
          <div className="fixed inset-0 grid place-items-center z-[100]">
            <motion.div
              ref={ref}
              layoutId={`card-${active._id}-${id}`}
              className="w-full max-w-[600px] bg-white rounded-xl shadow-lg overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-lg">Sales Order Detail</h3>
                <button
                  onClick={() => setActive(null)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  ✕
                </button>
              </div>

              {isLoadingDetail ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : salesOrderDetail?.data ? (
                <div className="p-4 space-y-4">
                  <div>
                    <p>
                      <strong>Return Value:</strong>{" "}
                      {salesOrderDetail.data.return_value}
                    </p>
                    <p>
                      <strong>Document No:</strong>{" "}
                      {salesOrderDetail.data.DocumentNo}
                    </p>
                    <p>
                      <strong>Customer No:</strong>{" "}
                      {salesOrderDetail.data.SellToCustNo}
                    </p>
                    <p>
                      <strong>Order Date:</strong>{" "}
                      {new Date(
                        salesOrderDetail.data.OrderDate
                      ).toLocaleDateString()}
                    </p>{" "}
                    <p>
                      <strong>Ext doc:</strong> {salesOrderDetail?.data?.ExtDoc}
                    </p>
                    <p>
                      <strong>Request Delivery Date:</strong>{" "}
                      {new Date(
                        salesOrderDetail.data.RequestDeliveryDate
                      ).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>Location Code:</strong>{" "}
                      {salesOrderDetail.data.LocationCode}
                    </p>
                    <p>
                      <strong>Sales Person Code:</strong>{" "}
                      {salesOrderDetail.data.SalespersonCode}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Sales Lines</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left">Item No</th>
                            <th className="p-2 text-right">Qty</th>
                            <th className="p-2 text-right">Unit Price</th>
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
      <ul className="max-w-2xl mx-auto w-full gap-4 mt-6">
        {isLoadingList ? (
          <p className="text-center text-gray-500">Loading Sales Orders...</p>
        ) : (
          salesOrderList.data?.map((so) => (
            <li
              key={so._id}
              onClick={() => {
                setSelectedSalesOrder(so);
                setActive(so);
              }}
              className="p-4 flex justify-between items-center bg-white border rounded-lg shadow-sm hover:bg-gray-50 cursor-pointer"
            >
              <div>
                <p className="font-semibold">{so.return_value}</p>
                <p className="text-sm text-gray-600">{so.DocumentNo}</p>
              </div>
              <span className="text-gray-400">›</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default ProcessPage;
