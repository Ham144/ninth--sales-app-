import CustomerApi from "@/api/customerApi";
import SalesOrderApi from "@/api/SalesOrderApi";
import ProductApi from "@/api/productApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { v4 as uuidv4 } from "uuid";
import ModalTempOption from "@/components/ModalTempOption";
import OnlyAsk from "@/components/OnlyAsk";
import { useUserInfo } from "@/store";
import locationApi from "@/api/LocationApi";
import Item from "@/components/Item";
import { Search } from "lucide-react";
import DatePickerWithButtons from "@/components/DatePickerWithButton";

const initialSalesOrder = {
  customer: {},
  products: [], // will include: { ...product, qty: 1 }
  requestDeliveryDate: "",
  frontendSession: "",
  keterangan: "",
  locationCode: "", // Initialize locationCode
};

const RequestPage = () => {
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [salesOrder, setSalesOrder] = useState(initialSalesOrder);
  const [pembayaranTertunda, setPembayaranTertunda] = useState();
  // state for stock modal is no longer needed; each product has its own dialog

  //simple redirect
  const { userInfo } = useUserInfo();

  //interactivity UI
  const [activeCustomerOptionIdx, setActiveCustomerOptionIdx] = useState(-1); // -1 artinya tidak ada yg dipilih
  const [isFocusedCustomer, setIsFocusedCustomer] = useState(false);

  //search result
  const { data: customerList } = useQuery({
    queryKey: ["customers", customerSearch],
    queryFn: async () => await CustomerApi.getAllCustomers(customerSearch),
    enabled: customerSearch.length > 1,
  });

  const { mutate: handleCreateTempSo } = useMutation({
    mutationKey: ["tempSO"],
    mutationFn: async () =>
      await SalesOrderApi.createTempSO({
        products: salesOrder.products,
        customerId: salesOrder.customer._id,
        frontendSession,
        comment: `${new Date().toLocaleTimeString()} - ${
          salesOrder.customer.Name
        }`,
      }),
    onSuccess: (res) => {
      console.log("Berhasil buat temp SO");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message) ||
        "Terjadi kesalahan buat temp SO";
    },
  });

  //states untuk Temp Sales order modal
  const [frontendSession, setFrontendSession] = useState();
  const debounceTimerRef = useRef(null);
  const [tempSalesOrderOption, setTempSalesOrderOption] = useState([]);

  // Function untuk temporary save dengan debounce
  const debouncedTempSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (
        salesOrder.products?.length > 0 &&
        salesOrder.customer?.No &&
        frontendSession
      ) {
        handleCreateTempSo();
      }
    }, 1000); // 1 detik delay
  }, [
    salesOrder.products?.length,
    salesOrder.customer?.No,
    frontendSession,
    handleCreateTempSo,
  ]);

  //customer get By No
  const { mutateAsync: selectCustomer } = useMutation({
    mutationKey: ["customer"],
    mutationFn: async (no) => await CustomerApi.getByNo(no),
    retry: false,
    onSuccess: async (data) => {
      setCustomerSearch("");
      setSalesOrder((prev) => ({
        ...prev,
        customer: data?.data?.customer,
        // Auto-set locationCode from customer's Location_Code if available
        locationCode: data?.data?.customer?.Location_Code || prev.locationCode,
      }));
      setPembayaranTertunda(data?.data?.pembayaranTertunda);
      //sekalian panggil temp so
      const tempSO = await SalesOrderApi.getTempSO(data?.data?.customer?._id);
      if (tempSO?.data?.data?.length > 0) {
        document.getElementById("modal-temp-so").showModal();
        setTempSalesOrderOption(tempSO?.data?.data);
      }

      const newFronendSession = uuidv4();
      setFrontendSession(newFronendSession);
      setSalesOrder((prev) => ({
        ...prev,
        frontendSession: newFronendSession,
      }));
      // Jika sudah ada products, trigger temporary save dengan customer baru
      if (salesOrder?.products?.length > 0) {
        debouncedTempSave();
      }
    },
    onError: (err) => {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.message ||
        err?.message ||
        "Terjadi kesalahan tak terduga";
      const detail =
        err?.response?.data?.data?.message || err?.response?.data?.data;
      const composed = [
        status ? `[${status}]` : null,
        msg,
        detail
          ? `- ${typeof detail === "string" ? detail : JSON.stringify(detail)}`
          : null,
      ]
        .filter(Boolean)
        .join(" ");
      toast.error(composed);
    },
  });

  //get  all location to fill dim1 and  location code
  const { data: locationList } = useQuery({
    queryKey: ["location"],
    queryFn: async () => await locationApi.getAllLocation(),
  });

  //query product
  const { data: productList } = useQuery({
    queryKey: ["products", productSearch],
    queryFn: async () => await ProductApi.getAllProducts(productSearch),
    enabled: productSearch.length > 1,
  });

  const handleKeyDown = (e) => {
    if (!customerList?.data || customerList.data.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCustomerOptionIdx((prev) =>
        prev < customerList.data.length - 1 ? prev + 1 : 0
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCustomerOptionIdx((prev) =>
        prev > 0 ? prev - 1 : customerList.data.length - 1
      );
    }

    if (e.key === "Enter" || e.key === "Tab") {
      if (activeCustomerOptionIdx >= 0) {
        e.preventDefault();
        selectCustomer(customerList.data[activeCustomerOptionIdx].No);
      }
    }
  };

  useEffect(() => {
    setActiveCustomerOptionIdx(-1); // Reset highlight when list changes
  }, [customerList]);

  useEffect(() => {
    if (!isFocusedCustomer) {
      // Delay sedikit agar klik list tidak langsung hilang
      const timeout = setTimeout(() => {
        setCustomerSearch("");
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isFocusedCustomer]);

  // Effect untuk auto-save temporary setiap kali ada perubahan
  useEffect(() => {
    if (
      salesOrder.products?.length > 0 &&
      salesOrder.customer?.No &&
      frontendSession
    ) {
      debouncedTempSave();
    }
  }, [salesOrder?.products?.length, salesOrder.customer?.No, frontendSession]);

  // Cleanup timer saat component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const navigate = useNavigate();

  //main
  const {
    mutateAsync: handleRequestSalesOrder,
    isPending: isPendingProcessing,
  } = useMutation({
    mutationKey: ["salesOrder"],
    mutationFn: async () => await SalesOrderApi.requestSalesOrder(salesOrder),
    onSuccess: () => {
      toast.success("SO berhasil dibuat");
      navigate("/process");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.message || "SO gagal dibuat"),
  });

  const addProduct = (prod) => {
    setSalesOrder((prev) => {
      const exists = prev.products?.find((p) => p.No === prod.No);
      if (exists)
        return {
          //jika anda tambahi quantity nya
          ...prev,
          products: prev.products?.map((p) =>
            p.No === prod.No ? { ...p, qty: p.qty + 1 } : p
          ),
        };

      const selectedCustomer = prev.customer;

      if (!selectedCustomer?.Customer_Price_Group) {
        toast.error("Customer belum dipilih atau tidak memiliki Price Group");
        return prev;
      }

      const targetKey = selectedCustomer.Customer_Price_Group.toUpperCase();

      // 1. Normalize keys jadi uppercase
      const normalizedProduct = Object.entries(prod).reduce(
        (acc, [key, value]) => {
          acc[key.toUpperCase()] = value;
          return acc;
        },
        {}
      );

      const matchedPrice = normalizedProduct[targetKey];

      // 2. Validasi harga
      if (matchedPrice == null || Number(matchedPrice) === 0) {
        toast.error(
          `Harga untuk Customer_Price_Group '${targetKey}' tidak ditemukan atau 0`
        );
        return prev;
      }

      return {
        ...prev,
        products: [
          {
            ...prod,
            qty: 1,
            priceGroupKey: targetKey,
            price: matchedPrice,
          },
          ...(prev.products || []),
        ],
      };
    });

    // Set frontendSession setelah state berhasil diupdate
    if (!frontendSession) {
      const uuid = uuidv4();
      setFrontendSession(uuid);
    }

    setProductSearch("");
  };

  const updateProductQty = (productNo, delta) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) =>
        p.No === productNo ? { ...p, qty: Math.max(1, p.qty + delta) } : p
      ),
    }));

    // Trigger temporary save setelah update quantity
    debouncedTempSave();
  };

  const setManualQty = (productNo, newQty) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) =>
        p.No === productNo ? { ...p, qty: newQty } : p
      ),
    }));

    // Trigger temporary save setelah set manual quantity
    debouncedTempSave();
  };

  const removeProduct = (productNo) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: (prev.products || []).filter((p) => p.No !== productNo),
    }));

    // Trigger temporary save setelah remove product
    if ((salesOrder.products || []).length > 1) {
      debouncedTempSave();
    }
  };

  useEffect(() => {
    if (userInfo?.description === "OVERDUE") {
      navigate("/not-found");
    }
  }, [userInfo]);

  return (
    <div className="min-h-screen pb-28  relative overflow-hidden">
      {/* Background layers */}
      <div className="absolute " />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />

      <div className="relative p-4 py-12 backdrop-blur-sm w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h3 className="text-3xl font-light text-indigo-900 mb-2">
            Sales Order Request
          </h3>
          <p className="text-indigo-600">
            Buat permintaan sales order untuk customer
          </p>
        </div>

        {/* 🔍 Search Customer */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-indigo-700 mb-1">
            Cari Customer
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-indigo-400"
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
              placeholder="Cari Customer (min 2 huruf)"
              value={customerSearch}
              onChange={(e) => {
                setSalesOrder(initialSalesOrder);
                setCustomerSearch(e.target.value);
              }}
              onFocus={() => setIsFocusedCustomer(true)}
              onBlur={() => setIsFocusedCustomer(false)}
              onKeyDown={handleKeyDown}
              className="pl-10 w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {customerList?.data?.length > 0 && (
            <div className="bg-white border border-indigo-200 rounded-xl shadow-md overflow-hidden mt-1">
              <ul className="divide-y divide-indigo-100">
                {customerList.data.map((cust, index) => (
                  <li key={cust._id}>
                    <button
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        index === activeCustomerOptionIdx
                          ? "bg-indigo-100 text-indigo-800"
                          : "hover:bg-indigo-50 text-indigo-700"
                      }`}
                      onClick={() => selectCustomer(cust.No)}
                    >
                      <div className="font-medium">{cust.Name}</div>
                      <div className="text-sm text-indigo-500">({cust.No})</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Customer Card */}
        {salesOrder.customer?.No && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 shadow-md border border-indigo-100">
            <h2 className="font-bold text-lg text-center text-indigo-800 mb-4">
              Customer Selected
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-lg font-semibold text-indigo-900">
                  {salesOrder.customer.Name}
                </p>
                <p className="text-sm text-indigo-600 mt-1">
                  {salesOrder.customer.Address}
                </p>
                <p className="text-sm text-indigo-700 mt-3">
                  <span className="font-medium">Salesperson:</span>{" "}
                  {salesOrder.customer.Salesperson_Code}
                </p>
              </div>
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-indigo-500">Balance</p>
                  <p className="font-semibold text-indigo-900">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Balance || "0")
                    )}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-indigo-500">Balance Due</p>
                  <p className="font-semibold text-indigo-900">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Balance_Due || "0")
                    )}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-indigo-100">
                  <p className="text-xs text-indigo-500">Credit Limit</p>
                  <p className="font-semibold text-indigo-900">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Credit_Limit_LCY || "0")
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 💸 SECTION: Pembayaran Tertunda */}
        {pembayaranTertunda?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-indigo-100">
            <h2 className="font-bold text-lg text-center text-indigo-800 mb-4">
              Pembayaran Tertunda
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-800">
                    <th className="p-3 font-semibold text-left rounded-l-xl">
                      No. Dokumen
                    </th>
                    <th className="p-3 font-semibold text-left">Jatuh Tempo</th>
                    <th className="p-3 font-semibold text-left">AR</th>
                    <th className="p-3 font-semibold text-right rounded-r-xl">
                      Sisa Pembayaran
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-100">
                  {pembayaranTertunda.map((item, i) => {
                    const formattedDate = new Date(
                      item.Due_Date
                    ).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });

                    return (
                      <tr key={i} className="hover:bg-indigo-50">
                        <td className="p-3">{item.Document_No}</td>
                        <td className="p-3">{formattedDate}</td>
                        <td className="p-3">{item?.AR}</td>
                        <td className="p-3 text-right font-semibold text-red-500">
                          {new Intl.NumberFormat("id-ID").format(
                            parseInt(item.Remaining_Amount)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 📦 Search Produk */}
        <div className="space-y-4 flex w-full">
          <div className="flex flex-1 md:flex-row gap-4 items-start">
            <div className="flex-1">
              <label className="block text-sm font-medium text-indigo-700 mb-1">
                Cari Produk
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-indigo-500" />
                </div>
                <input
                  disabled={!salesOrder.customer?.No}
                  placeholder="Cari Produk (min 2 huruf)"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10 w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl disabled:bg-indigo-50 disabled:text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {productList?.data?.length > 0 && (
                <div className="bg-white border border-indigo-200 rounded-xl shadow-md overflow-hidden mt-1">
                  <ul className="divide-y divide-indigo-100 max-h-60 overflow-y-auto">
                    {productList.data.map((prod) => (
                      <li key={prod._id}>
                        <button
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                          onClick={() => addProduct(prod)}
                        >
                          <div className="font-medium text-indigo-900">
                            {prod.Description}
                          </div>
                          <div className="text-sm text-indigo-500">
                            ({prod.No})
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              disabled={!salesOrder?.customer?.No}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mt-6"
              onClick={() => document.getElementById("only-ask").showModal()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Diskusi <span className="max-md:hidden">Produk</span>
            </button>
          </div>
        </div>

        {/* Pilih location */}
        <div>
          <label className="text-sm font-medium flex  gap-x-2  items-center text-indigo-700 mb-1 max-md:flex-col ">
            Pilih Lokasi
            {userInfo?.description.split("_")[1] && (
              <div className="p-1 rounded-sm bg-primary text-white my-2">
                Location default dari customer karena user anda spesifik{" "}
                {userInfo?.description.split("_")[1]}
              </div>
            )}
          </label>

          <div className="relative">
            <select
              disabled={
                userInfo?.description.startsWith("SALES")
                  ? userInfo?.description.split("_")[1]
                    ? true
                    : false
                  : false
              }
              onChange={(e) => {
                setSalesOrder((prev) => ({
                  ...prev,
                  locationCode: e.target.value,
                }));
              }}
              value={salesOrder?.locationCode}
              className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
            >
              <option disabled selected>
                Pilih Location Manual atau kosongkan untuk disesuaikan dengan
                Location_Code customer
              </option>
              {locationList?.data?.length ? (
                locationList.data.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))
              ) : (
                <option disabled hidden>
                  Tidak Ada Data
                </option>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-600">
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

        {/* 🛒 Daftar Produk */}
        {salesOrder?.products?.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-indigo-100">
            <h2 className="font-bold text-lg text-indigo-800 mb-4">
              Daftar Produk
            </h2>
            <div className="max-h-80 overflow-y-scroll space-y-3 pr-2">
              {salesOrder?.products?.map((prod) => (
                <Item
                  updateProductQty={updateProductQty}
                  setManualQty={setManualQty}
                  removeProduct={removeProduct}
                  prod={prod}
                  key={prod.No}
                  selectedLocationCode={salesOrder?.locationCode}
                />
              ))}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              Keterangan Tambahan
            </label>
            <textarea
              placeholder="Masukkan Keterangan yang ingin anda tambahkan"
              value={salesOrder.keterangan}
              onChange={(e) =>
                setSalesOrder((prev) => ({
                  ...prev,
                  keterangan: e.target.value,
                }))
              }
              className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-700 mb-1">
              Request Delivery Date{" "}
            </label>
            <DatePickerWithButtons
              value={salesOrder.requestDeliveryDate}
              onChange={(date) =>
                setSalesOrder((prev) => ({
                  ...prev,
                  requestDeliveryDate: date,
                }))
              }
              placeholder="Pilih tanggal..."
              minDate={new Date()} // optional
              maxDate={new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)} // optional
              disabled={false}
            />
          </div>
          <button
            onClick={handleRequestSalesOrder}
            disabled={
              !salesOrder.customer?.No ||
              salesOrder?.products?.length === 0 ||
              isPendingProcessing
            }
            className="px-8 w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isPendingProcessing && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            )}
            <span>Kirim Sales Order</span>
          </button>
        </div>

        <ModalTempOption
          setFrontendSession={setFrontendSession}
          setSalesOrder={setSalesOrder}
          tempSalesOrderOption={tempSalesOrderOption}
          setTempSalesOrderOption={setTempSalesOrderOption}
          key={"modal-temp-so"}
        />
        <OnlyAsk
          key={"only-ask"}
          salesOrder={salesOrder}
          setSalesOrder={setSalesOrder}
          locationCode={salesOrder.locationCode}
        />
      </div>
    </div>
  );
};

export default RequestPage;
