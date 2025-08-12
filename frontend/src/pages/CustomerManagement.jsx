import CustomerApi from "@/api/customerApi";
import PengelolaSideBarMenu from "@/components/PengelolasSideBarMenu";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

const CustomerManagement = () => {
  const [searchKey, setSearchKey] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const {
    data: customerList,
    isLoading: isCustomersLoading,
    isError: isCustomersError,
    isFetching: isCustomerFetching,
  } = useQuery({
    queryKey: ["customers", searchKey, page, limit],
    queryFn: () => CustomerApi.getAllCustomers(searchKey, page, limit),
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const {
    data: selectedCustomerDetail,
    isLoading: isDetailLoading,
    isError: isDetailError,
  } = useQuery({
    queryKey: ["customer", selectedCustomer?.No],
    queryFn: () => CustomerApi.getByNo(selectedCustomer?.No),
    enabled: !!selectedCustomer,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setPage(1);
  }, [searchKey, limit]);

  const openModal = (customer) => {
    setSelectedCustomer(customer);
    document.getElementById("modal-customer-detail").showModal();
  };

  const closeModal = () => {
    setSelectedCustomer(null);
    document.getElementById("modal-customer-detail").close();
  };

  return (
    <PengelolaSideBarMenu>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-light text-gray-800 mb-6">
            Customer Management
          </h2>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="form-control rounded-md  w-full max-w-md">
              <input
                type="text"
                placeholder="Search customer..."
                className="input input-bordered rounded-md w-full"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* content */}
        <div className="backdrop rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="text-gray-700 font-semibold">No</th>
                  <th className="text-gray-700 font-semibold">Name</th>
                </tr>
              </thead>
              <tbody>
                {isCustomersLoading ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-gray-500">
                      <span className="loading loading-spinner loading-md mr-2" />
                      Loading customers...
                    </td>
                  </tr>
                ) : isCustomersError ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-error">
                      Gagal memuat data customer.
                    </td>
                  </tr>
                ) : customerList?.data?.length ? (
                  customerList.data.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openModal(c)}
                    >
                      <td className="font-mono text-sm">{c.No}</td>
                      <td className="font-medium text-gray-900">{c.Name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2}
                      className="text-center text-sm text-gray-500 py-6"
                    >
                      Tidak ada data customer.
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
              const total = customerList?.total ?? 0;
              const start = total === 0 ? 0 : (page - 1) * limit + 1;
              const end = Math.min(page * limit, total);
              return (
                <span>
                  Menampilkan {start}-{end} dari {total} customer
                  {isCustomerFetching ? (
                    <span className="ml-2 loading loading-dots loading-xs align-middle" />
                  ) : null}
                </span>
              );
            })()}
          </div>

          <div className="flex items-center gap-3 ">
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
              const totalPages = customerList?.totalPages ?? 1;
              const currentPage = customerList?.currentPage ?? page;
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

        <dialog id="modal-customer-detail" className="modal">
          <div className="modal-box w-11/12 max-w-3xl">
            {selectedCustomer && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-2xl text-gray-800">
                    Customer Detail
                  </h3>
                  <button
                    onClick={closeModal}
                    className="btn btn-sm btn-circle btn-ghost"
                  >
                    ✕
                  </button>
                </div>

                {/* Basic Info */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-700">Customer</h4>
                      <p className="text-lg font-bold text-gray-900">
                        {selectedCustomer.Name}
                      </p>
                      <p className="text-sm text-gray-600">
                        No: {selectedCustomer.No}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detail from API */}
                {isDetailLoading && (
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className="loading loading-spinner loading-md" />
                    <span>Loading detail...</span>
                  </div>
                )}
                {isDetailError && (
                  <div className="alert alert-error text-sm">
                    Gagal memuat detail customer. Coba lagi.
                  </div>
                )}

                {selectedCustomerDetail?.data &&
                  (() => {
                    const raw = selectedCustomerDetail.data;
                    const entity = Array.isArray(raw)
                      ? raw[0]
                      : raw.customer || raw;
                    if (!entity) return null;
                    const rows = [
                      { label: "Name", value: entity.Name },
                      { label: "Address", value: entity.Address },
                      { label: "Address 2", value: entity.Address_2 },
                      { label: "City", value: entity.City },
                      { label: "Phone", value: entity.Phone_No },
                      { label: "Salesperson", value: entity.Salesperson_Code },
                      {
                        label: "Payment Term",
                        value: entity.Payment_Terms_Code,
                      },
                      { label: "Credit Limit", value: entity.Credit_Limit_LCY },
                      { label: "Balance", value: entity.Balance },
                      { label: "Balance Due", value: entity.Balance_Due },
                      {
                        label: "VAT Group",
                        value: entity.VAT_Bus_Posting_Group,
                      },
                      {
                        label: "WHT Group",
                        value: entity.WHT_Business_Posting_Group,
                      },
                      { label: "Location Code", value: entity.Location_Code },
                      { label: "Area", value: entity._x003C_Area_x003E_ },
                    ].filter(
                      (r) =>
                        r.value !== undefined &&
                        r.value !== null &&
                        r.value !== ""
                    );
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {rows.map((row) => (
                          <div
                            key={row.label}
                            className="bg-white border border-gray-200 rounded-lg p-3"
                          >
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {row.label}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mt-1">
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

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

export default CustomerManagement;
