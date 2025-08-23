import OverdueApi from "@/api/OverdueApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import Calendar22 from "@/components/ui/DatePicker";

const OverduePage = () => {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(); // 30 hari sebelum hari ini
  const [endDate, setEndDate] = useState();

  const skip = (page - 1) * limit;

  // Fetch overdue list
  const { data: overdueList, isPending: overduePending } = useQuery({
    queryKey: ["overdue", skip, page, search, startDate, endDate],
    queryFn: async () =>
      await OverdueApi.list({ search, limit, skip, page, startDate, endDate }),
  });

  // Renew data from SOAP
  const { mutateAsync: handleRenewOverdueList, isPending: renewPending } =
    useMutation({
      mutationKey: ["overdue", "renew"],
      mutationFn: async () => {
        toast.loading("Proses memperbarui overdue data memakan waktu lama...");
        await OverdueApi.renewOverdue();
        toast.dismiss();
      },
      onSuccess: (res) => {
        toast.success(
          res?.response?.data?.message || "Berhasil memperbarui overdue data"
        );
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message || "Gagal memperbarui overdue data"
        );
      },
    });

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1); // reset page saat search berubah
  };

  const totalData = overdueList?.data?.total || 0;
  const totalPages = totalData > 0 ? Math.ceil(totalData / limit) : 1;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <h2 className="text-3xl title">Overdue Page</h2>
        <div className="flex gap-x-3 ">
          <Calendar22
            date={startDate}
            setDate={setStartDate}
            label={"start due date"}
          />
          <Calendar22
            date={endDate}
            setDate={setEndDate}
            label={"end due date"}
          />
          <div className="flex gap-3 items-center ">
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Cari by Doc No | Customer No | Customer Name..."
              className="input rounded-lg input-bordered w-64"
            />
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto h-[70vh] backdrop rounded-lg shadow relative">
        <table className="table w-full">
          <thead className="sticky top-0 backdrop text-black">
            <tr>
              <th>No</th>
              <th>Document No</th>
              <th>Customer</th>
              <th>Posting Date</th>
              <th>Due Date</th>
              <th>Remaining Amount</th>
              <th>Status</th>
              <th>Salesperson</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            {overduePending ? (
              <tr>
                <td colSpan="10" className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-gray-500 mt-2">Loading data...</p>
                </td>
              </tr>
            ) : overdueList?.data?.data?.length > 0 ? (
              overdueList.data.data.map((item, index) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td>{skip + index + 1}</td>
                  <td>{item.documentNo}</td>
                  <td>
                    <div className="font-medium">{item.Name}</div>
                    <div className="text-xs text-gray-500">
                      {item.customerNo}
                    </div>
                  </td>
                  <td>{new Date(item.postingDate).toLocaleDateString()}</td>
                  <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td>
                    {item.remainingAmount.toLocaleString("id-ID", {
                      style: "currency",
                      currency: item.currency || "IDR",
                    })}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        item.status === "Overdue"
                          ? "badge-error text-white"
                          : "badge-success text-white"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.salespersonCode}</td>
                  <td>
                    <div className="text-sm">{item.Phone_No}</div>
                    <div className="text-xs text-gray-500">{item.Email}</div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="text-center text-gray-500 py-6">
                  Tidak ada data ditemukan
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <button
          onClick={() => {
            const confirm = window.confirm("Ini akan memakan waktu cukup lama");
            if (confirm) {
              handleRenewOverdueList();
            }
          }}
          className="btn btn-sm my-3 mx-2 rounded-lg shadow-sm text-white bg-orange-400 flex items-center gap-2"
          disabled={renewPending}
        >
          {renewPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Refresh Data
        </button>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn btn-outline btn-sm"
            >
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="btn btn-outline btn-sm"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Rows per page:</span>
            <select
              className="select select-bordered select-sm"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverduePage;
