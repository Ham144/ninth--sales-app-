import axiosInstance from "@/api/axiosInstance";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/monthpicker";
import { useUserInfo } from "@/store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, Download, DownloadCloud } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DownloadPage = () => {
  const { userInfo } = useUserInfo();
  const [fe_search, setFeSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [previewSalesOrderFiltered, setPreviewSalesOrderFiltered] = useState(
    []
  );

  //getPreview
  const { data: previewSalesOrder = [] } = useQuery({
    queryKey: ["download-sales-order", selectedMonth],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/v1/salesOrder/download", {
        params: {
          month: selectedMonth,
          preview: true,
          return_valueType: "SMA",
        },
      });
      return res.data;
    },
  });

  const { mutateAsync: handleDownload } = useMutation({
    mutationKey: ["salesOrder"],
    mutationFn: async () => {
      const res = await axiosInstance.get("/api/v1/salesOrder/download", {
        params: { month: selectedMonth, return_valueType: "SMA" },
      });

      const rows = res?.data || [];

      const escapeCsv = (value) => {
        if (value === undefined || value === null) return "";
        const str = String(value);
        const needsQuotes = /[",\n]/.test(str);
        const escaped = str.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      };

      const normalizeDate = (d) => {
        if (!d) return "";
        const date = new Date(d);
        return isNaN(date.getTime()) ? String(d) : date.toISOString();
      };

      const headers = [
        "return_value",
        "DocumentNo",
        "customer.Name",
        "customer.No",
        "ShiptToCode",
        "OrderDate",
        "LocationCode",
        "Dim1",
        "CustomerPriceGrp",
        "SalespersonCode",
        "SellToContact",
        "NoSeries",
        "ExtDoc",
        "RequestDeliveryDate",
        "Keterangan",
        "SalesLineTotal",
        "org.organizationName",
        "createdBy.username",
        // SalesLine fields (each SalesLine becomes one CSV row)
        "SalesLine.ItemNo",
        "SalesLine.Qty",
        "SalesLine.UnitPrice",
        "SalesLine.LineNo",
      ];

      const getByPath = (obj, path) => {
        return path
          .split(".")
          .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
      };

      const csvLines = [headers.join(",")];
      for (const row of rows) {
        const salesLines =
          Array.isArray(row?.SalesLine) && row.SalesLine.length > 0
            ? row.SalesLine
            : [null];
        for (const line of salesLines) {
          const values = headers.map((h) => {
            if (h === "OrderDate" || h === "RequestDeliveryDate") {
              return escapeCsv(normalizeDate(row[h]));
            }
            if (h === "CustomerPriceGrp") {
              return escapeCsv(
                row?.CustomerPriceGrp ??
                  row?.customer?.Customer_Price_Group ??
                  ""
              );
            }
            if (h === "SalespersonCode") {
              return escapeCsv(
                row?.SalespersonCode ?? row?.customer?.Salesperson_Code ?? ""
              );
            }
            if (h === "SalesLine.ItemNo") return escapeCsv(line?.ItemNo ?? "");
            if (h === "SalesLine.Qty") return escapeCsv(line?.Qty ?? 0);
            if (h === "SalesLine.UnitPrice")
              return escapeCsv(line?.UnitPrice ?? 0);
            if (h === "SalesLine.LineNo") return escapeCsv(line?.LineNo ?? "");
            const val = getByPath(row, h);
            return escapeCsv(val);
          });
          csvLines.push(values.join(","));
        }
      }

      const csvData = csvLines.join("\n");

      const blob = new Blob([csvData], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "salesOrder.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  //ini untuk pencarian frontend-only untuk mengecek apakah ada yang diinginkan
  useEffect(() => {
    if (fe_search.length > 2) {
      setPreviewSalesOrderFiltered(
        previewSalesOrder?.data?.filter(
          (item) =>
            item.return_value
              .toLowerCase()
              .includes(fe_search?.toLowerCase()) ||
            item.DocumentNo.toLowerCase().includes(fe_search?.toLowerCase())
        )
      );
    } else {
      setPreviewSalesOrderFiltered(previewSalesOrder);
    }
  }, [previewSalesOrder, fe_search]);

  return (
    <div className="min-h-screen pb-28 relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Animated background elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <div className="relative p-6 py-12 w-full max-w-6xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <Download />
          </div>
          <h1 className="text-4xl font-bold text-indigo-900 mb-3">
            Download Data Sales Order
          </h1>
          <p className="text-lg text-indigo-600 mb-4 max-w-2xl mx-auto">
            Unduh data sales order dalam format Excel untuk analisis dan
            pelaporan
          </p>

          <div className="bg-amber-100 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg inline-flex items-center max-w-2xl mx-auto mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">
              Beberapa data mungkin tidak terdownload sesuai ketentuan kami
            </span>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Bulan
              </label>
              <div className="dropdown dropdown-bottom">
                <label
                  tabIndex={0}
                  className="btn btn-outline rounded-lg w-full md:w-64 justify-between"
                >
                  <span>
                    {selectedMonth !== null
                      ? new Intl.DateTimeFormat("id-ID", {
                          month: "long",
                        }).format(
                          new Date(new Date().getFullYear(), selectedMonth, 1)
                        )
                      : "Pilih bulan"}
                  </span>

                  <ArrowDown />
                </label>
                <div
                  tabIndex={0}
                  className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-64 mt-2"
                >
                  <MonthPicker
                    onMonthSelect={(e) => {
                      setSelectedMonth(new Date(e).getMonth());
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cari Data
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fe_search}
                  placeholder="Document No / Return Value"
                  className="input input-bordered rounded-lg w-full pl-10"
                  onChange={(e) => setFeSearch(e.target.value)}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 absolute left-3 top-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-4 md:mt-6">
              <button
                onClick={handleDownload}
                className="btn btn-primary rounded-lg px-6 py-3 flex items-center gap-2 text-white"
              >
                <DownloadCloud />
                Download Semua
              </button>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800">
              Preview Data
            </h3>
            <span className="text-sm text-gray-500">
              {previewSalesOrderFiltered?.length} items ditemukan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-2">
            {previewSalesOrderFiltered?.map((item) => (
              <div
                key={item._id}
                className="border border-gray-200 rounded-xl p-4 transition-all hover:shadow-md hover:border-indigo-300 cursor-pointer bg-gradient-to-br from-white to-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {item.ExtDoc}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.OrderDate).toLocaleDateString("id-ID")}
                  </span>
                </div>

                <h4 className="font-semibold text-gray-800 truncate mb-2">
                  {item.customer?.Name}
                </h4>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <span className="text-sm font-medium text-green-600">
                    {item.return_value}
                  </span>
                  <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!previewSalesOrderFiltered?.length && (
            <div className="text-center py-12 text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-gray-300 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p>Tidak ada data untuk ditampilkan</p>
              <p className="text-sm">
                Pilih bulan atau ubah kata kunci pencarian
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
