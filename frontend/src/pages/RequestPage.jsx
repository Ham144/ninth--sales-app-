import CustomerApi from "@/api/customerApi";
import SalesOrderApi from "@/api/SalesOrderApi";
import ProductApi from "@/api/productApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import ModalShowStock from "@/components/ModalShowStock";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { v4 as uuidv4 } from "uuid";
import ModalTempOption from "@/components/ModalTempOption";
import OnlyAsk from "@/components/OnlyAsk";
import { useUserInfo } from "@/store";
import locationApi from "@/api/LocationApi";

const initialSalesOrder = {
  customer: {},
  products: [], // will include: { ...product, qty: 1 }
  requestDeliveryDate: "",
  frontendSession: "",
  keterangan: "",
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
    onSuccess: async (data) => {
      setCustomerSearch("");
      setSalesOrder((prev) => ({
        ...prev,
        customer: data?.data?.customer,
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
      if (salesOrder.products?.length > 0) {
        debouncedTempSave();
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Terjadi kesalahan");
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
          ...(prev.products || []),
          {
            ...prod,
            qty: 1,
            priceGroupKey: targetKey,
            price: matchedPrice,
          },
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

  const updateProductQty = (sku, delta) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: (prev.products || []).map((p) =>
        p.No === sku ? { ...p, qty: Math.max(1, p.qty + delta) } : p
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

  const removeProduct = (sku) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: (prev.products || []).filter((p) => p.No !== sku),
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
    <div className="p-4 py-20  backdrop-blur-sm  w-full mx-auto space-y-6 container bg ">
      {/* 🔍 Search Customer */}
      <h3 className="text-2xl font-light text-center">Sales Order Request</h3>
      <div className="space-y-2">
        <Input
          placeholder="Cari Customer (min 2 huruf)"
          value={customerSearch}
          onChange={(e) => {
            setSalesOrder(initialSalesOrder);
            setCustomerSearch(e.target.value);
          }}
          onFocus={() => setIsFocusedCustomer(true)}
          onBlur={() => setIsFocusedCustomer(false)}
          onKeyDown={handleKeyDown}
          className="input input-bordered w-full"
        />

        {customerList?.data?.length > 0 && (
          <ul className="bg-muted backdrop rounded-md divide-y border">
            {customerList.data.map((cust, index) => (
              <li key={cust._id}>
                <button
                  className={`w-full text-left px-4 py-2 ${
                    index === activeCustomerOptionIdx
                      ? "bg-accent"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => selectCustomer(cust.No)}
                >
                  {cust.Name} ({cust.No})
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {salesOrder.customer?.No && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-bold text-lg text-center">Customer</h2>
            <div className="flex justify-between items-center ">
              <div>
                <p className="text-sm font-medium">
                  {salesOrder.customer.Name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {salesOrder.customer.Address}
                </p>
                <p className="text-sm">
                  Salesperson: {salesOrder.customer.Salesperson_Code}
                </p>
              </div>
              <div>
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-medium">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Balance || "0")
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Balance Due</p>
                  <p className="font-medium">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Balance_Due || "0")
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credit Limit</p>
                  <p className="font-medium">
                    Rp{" "}
                    {new Intl.NumberFormat("id-ID").format(
                      parseInt(salesOrder.customer.Credit_Limit_LCY || "0")
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* 💸 SECTION: Pembayaran Tertunda */}
      {pembayaranTertunda?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-bold text-lg text-center mb-4">
              Pembayaran Tertunda
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="p-2 font-semibold">No. Dokumen</th>
                    <th className="p-2 font-semibold">Jatuh Tempo</th>
                    <th className="p-2 font-semibold">AR</th>
                    <th className="p-2 font-semibold text-right">
                      Sisa Pembayaran
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pembayaranTertunda.map((item, i) => {
                    const formattedDate = new Date(
                      item.Due_Date
                    ).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });

                    return (
                      <tr key={i}>
                        <td className="p-2">{item.Document_No}</td>
                        <td className="p-2">{formattedDate}</td>
                        <td className="p-2">{item?.AR}</td>
                        <td className="p-2 text-right font-bold text-red-500">
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
          </CardContent>
        </Card>
      )}

      {/* 📦 Search Produk */}
      <div className="space-y-2 flex items-center gap-x-3">
        <div className="flex flex-col w-full ">
          <Input
            disabled={salesOrder.customer?.No ? false : true}
            placeholder="Cari Produk (min 2 huruf)"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="rounded-md"
          />
          {productList?.data?.length > 0 && (
            <ul className="bg-muted rounded-md divide-y border backdrop mt-2">
              {productList.data.map((prod) => (
                <li key={prod._id}>
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-accent"
                    onClick={() => addProduct(prod)}
                  >
                    {prod.Description} ({prod.No})
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          disabled={salesOrder?.customer?.No ? false : true}
          className="translate-y-[-4px] text-white py-3 bg-orange-400 hover:bg-orange-300"
          onClick={() => document.getElementById("only-ask").showModal()}
        >
          Diskusi Produk
        </Button>
      </div>

      {/* 🛒 Daftar Produk */}
      {salesOrder?.products?.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4 ">
            <h2 className="font-bold text-lg">Daftar Produk</h2>
            <ScrollArea className="max-h-80 overflow-y-auto space-y-2 pr-2">
              {salesOrder?.products?.map((prod) => (
                <div
                  key={prod.No}
                  className="border rounded-lg mb-3 p-3 flex justify-between items-center"
                >
                  <div className="text-sm space-y-1">
                    <AlertDialog>
                      <div className="text-sm mb-3 space-y-1">
                        <p className="font-medium">{prod.Description}</p>
                        <p className="text-muted-foreground">SKU: {prod.No}</p>
                        <p>
                          Harga: {Intl.NumberFormat("id-ID").format(prod.price)}
                        </p>
                      </div>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline">Show Stock Detail</Button>
                      </AlertDialogTrigger>
                      <ModalShowStock
                        No={prod.No}
                        customer={salesOrder.customer}
                      />
                    </AlertDialog>
                  </div>
                  <div
                    key={prod.No}
                    className="border h-full rounded-lg p-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2"
                  >
                    {/* Tombol-tombol qty */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateProductQty(prod.No, -1)}
                      >
                        -
                      </Button>

                      {/* Input manual qty */}
                      <input
                        type="number"
                        className="w-16 border rounded text-center"
                        value={prod.qty}
                        min="0"
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value, 10) || 0;
                          setManualQty(prod.No, newQty);
                        }}
                      />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateProductQty(prod.No, 1)}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeProduct(prod.No)}
                      >
                        x
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <select
        onChange={(e) => {
          setSalesOrder((prev) => ({
            ...prev,
            locationCode: e.target.value,
          }));
        }}
        value={salesOrder?.locationCode}
        className="select bg-slate-50 rounded-lg w-full "
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

      <div className="flex flex-wrap gap-3 items-center">
        <textarea
          placeholder="Masukkan Keterangan yang ingin anda tambahkan"
          value={salesOrder.keterangan}
          onChange={(e) =>
            setSalesOrder((prev) => ({
              ...prev,
              keterangan: e.target.value,
            }))
          }
          className="textarea font-light bg-slate-50  rounded-lg textarea-bordered w-full pr-32"
          rows={2}
        />
        {/* Input + Tombol Shortcut */}
        <div className="flex w-full md:w-96 relative">
          <input
            type="text"
            placeholder="(dd/mm/yyyy) RDD "
            value={salesOrder.requestDeliveryDate}
            onChange={(e) =>
              setSalesOrder((prev) => ({
                ...prev,
                requestDeliveryDate: e.target.value,
              }))
            }
            className="input  font-light  h-10 rounded-lg input-bordered w-full pr-32"
          />
          {/* Tombol Hari ini */}
          {/* Tombol Hari ini */}
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const day = String(today.getDate()).padStart(2, "0");
              const month = String(today.getMonth() + 1).padStart(2, "0"); // month is 0-based
              const year = today.getFullYear();
              const formatted = `${day}/${month}/${year}`;

              setSalesOrder((prev) => ({
                ...prev,
                requestDeliveryDate: formatted,
              }));
            }}
            className="absolute right-20 top-1/2 -translate-y-1/2 bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded-md text-sm transition"
          >
            Hari ini
          </button>

          {/* Tombol Besok */}
          <button
            type="button"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const day = String(tomorrow.getDate()).padStart(2, "0");
              const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
              const year = tomorrow.getFullYear();
              const formatted = `${day}/${month}/${year}`;

              setSalesOrder((prev) => ({
                ...prev,
                requestDeliveryDate: formatted,
              }));
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm transition"
          >
            Besok
          </button>
        </div>

        {/* Tombol Kirim Sales Order */}
        <button
          onClick={handleRequestSalesOrder}
          disabled={
            !salesOrder.customer?.No ||
            salesOrder?.products?.length === 0 ||
            isPendingProcessing
          }
          className="w-full flex-1  md:w-auto disabled:cursor-not-allowed px-8 py-2 rounded-full relative bg-slate-700 text-white text-sm hover:shadow-2xl hover:shadow-white/[0.1] transition duration-200 border border-slate-600 flex items-center justify-center"
        >
          <div className="absolute inset-x-0 h-px w-1/2 mx-auto -top-px shadow-2xl bg-gradient-to-r from-transparent via-teal-500 to-transparent" />
          <span className="relative z-20">
            {isPendingProcessing && (
              <span className="loading loading-ring loading-lg mr-2"></span>
            )}
            <span>Kirim Sales Order</span>
          </span>
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
      />
    </div>
  );
};

export default RequestPage;
