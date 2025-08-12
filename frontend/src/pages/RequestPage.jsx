import CustomerApi from "@/api/customerApi";
import SalesOrderApi from "@/api/SalesOrderApi";
import ProductApi from "@/api/productApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import ModalShowStock from "@/components/ModalShowStock";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const initialSalesOrder = {
  customer: {},
  products: [], // will include: { ...product, qty: 1 }
};

const RequestPage = () => {
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [salesOrder, setSalesOrder] = useState(initialSalesOrder);
  const [pembayaranTertunda, setPembayaranTertunda] = useState();
  // state for stock modal is no longer needed; each product has its own dialog

  //search result
  const { data: customerList } = useQuery({
    queryKey: ["customers", customerSearch],
    queryFn: async () => await CustomerApi.getAllCustomers(customerSearch),
    enabled: customerSearch.length > 1,
  });

  //get By No
  const { mutateAsync: selectCustomer } = useMutation({
    mutationKey: ["customer"],
    mutationFn: async (no) => await CustomerApi.getByNo(no),
    onSuccess: (data) => {
      setCustomerSearch("");
      setSalesOrder((prev) => ({ ...prev, customer: data?.data?.customer }));
      setPembayaranTertunda(data?.data?.pembayaranTertunda);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Terjadi kesalahan");
    },
  });

  const { data: productList } = useQuery({
    queryKey: ["products", productSearch],
    queryFn: async () => await ProductApi.getAllProducts(productSearch),
    enabled: productSearch.length > 1,
  });

  const navigate = useNavigate();
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
      const exists = prev.products.find((p) => p.No === prod.No);
      if (exists) return prev;

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
          ...prev.products,
          {
            ...prod,
            qty: 1,
            priceGroupKey: targetKey,
            price: matchedPrice,
          },
        ],
      };
    });

    setProductSearch("");
  };

  const updateProductQty = (sku, delta) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.No === sku ? { ...p, qty: Math.max(1, p.qty + delta) } : p
      ),
    }));
  };

  const removeProduct = (sku) => {
    setSalesOrder((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.No !== sku),
    }));
  };

  useEffect(() => {
    //jika product search kosong maka hapus rekomendasi
    if (productSearch === "") {
      toast("Rekomendasi dihapus");
    }
  }, [productSearch]);

  return (
    <div className="p-4 py-20 overflow-y-auto h-screen  backdrop-blur-sm  w-full mx-auto space-y-6 container bg">
      {/* 🔍 Search Customer */}
      <h3 className="text-2xl font-light text-center">Sales Order Request</h3>
      <div className="space-y-2">
        <Input
          placeholder="Cari Customer (min 2 huruf)"
          value={customerSearch}
          onChange={(e) => setCustomerSearch(e.target.value)}
        />
        {customerList?.data?.length > 0 && (
          <ul className="bg-muted rounded-md divide-y border">
            {customerList.data.map((cust) => (
              <li key={cust._id}>
                <button
                  className="w-full text-left px-4 py-2 hover:bg-accent"
                  onClick={() => selectCustomer(cust?.No)}
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
      <div className="space-y-2">
        <Input
          disabled={salesOrder.customer?.No ? false : true}
          placeholder="Cari Produk (min 2 huruf)"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
        {productList?.data?.length > 0 && (
          <ul className="bg-muted rounded-md divide-y border">
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
      {/* 🛒 Daftar Produk */}
      {salesOrder.products.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4 ">
            <h2 className="font-bold text-lg">Daftar Produk</h2>
            <ScrollArea className="max-h-80 overflow-y-auto space-y-2 pr-2">
              {salesOrder.products.map((prod) => (
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
                      <ModalShowStock No={prod.No} />
                    </AlertDialog>
                  </div>
                  <div
                    key={prod.No}
                    className="border h-full rounded-lg p-3 flex flex-col md:flex-row md:justify-between  md:items-center gap-2"
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
                      <span>{prod.qty}</span>
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
      <button
        onClick={handleRequestSalesOrder}
        disabled={
          !salesOrder.customer?.No ||
          salesOrder.products.length === 0 ||
          isPendingProcessing
        }
        className="w-full px-8 py-2 rounded-full relative bg-slate-700 text-white text-sm hover:shadow-2xl hover:shadow-white/[0.1] transition duration-200 border border-slate-600"
      >
        <div className="absolute inset-x-0 h-px w-1/2 mx-auto -top-px shadow-2xl  bg-gradient-to-r from-transparent via-teal-500 to-transparent" />
        <span className="relative z-20">
          {" "}
          {isPendingProcessing && (
            <span className="loading loading-ring loading-lg"></span>
          )}{" "}
          Kirim Sales Order
        </span>
      </button>
      {/** per-product dialogs are rendered inline above */}
    </div>
  );
};

export default RequestPage;
