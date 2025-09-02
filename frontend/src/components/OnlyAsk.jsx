import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProductApi from "@/api/productApi";
import { toast, Toaster } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { AlertDialog } from "./ui/alert-dialog";
import { Trash2 } from "lucide-react";
import Item from "./Item";

const OnlyAsk = ({ setSalesOrder, salesOrder, locationCode }) => {
  const [askedProduct, setAskedProduct] = useState([]);

  const [productSearch, setProductSearch] = useState("");

  //UI interactivity
  const [activeProductOptionIdx, setActiveProductOptionIdx] = useState(-1); // -1 artinya tidak ada yg dipilih
  const [isFocusedProduct, setIsFocusedProduct] = useState(false);

  //search result
  const { data: productList } = useQuery({
    queryKey: ["products", productSearch],
    queryFn: async () => await ProductApi.getAllProducts(productSearch),
    enabled: productSearch.length > 1,
  });

  //add product to askedProduct not sales order
  const addProduct = async (prod) => {
    const selectedCustomer = salesOrder.customer;

    if (!selectedCustomer?.Customer_Price_Group) {
      toast.error("Customer tidak memiliki Price Group");
      return;
    }

    const targetKey = selectedCustomer.Customer_Price_Group.toUpperCase();

    // ✅ Normalize keys jadi uppercase
    const normalizedProduct = Object.entries(prod).reduce(
      (acc, [key, value]) => {
        acc[key.toUpperCase()] = value;
        return acc;
      },
      {}
    );

    const matchedPrice = normalizedProduct[targetKey];

    if (matchedPrice == null || Number(matchedPrice) === 0) {
      toast.error(
        `Harga untuk Customer_Price_Group '${targetKey}' tidak ditemukan atau 0`
      );
      return;
    }

    // ✅ Ambil stok terbaru
    const stockResponse = await ProductApi.getStockByNo({
      locationCode,
      No: prod.No,
    });
    const stockDataRaw = stockResponse?.data?.[0] || {};

    // ✅ Cari stok sesuai lokasi customer
    const customerLocation = selectedCustomer._x003C_Area_x003E_; // contoh: "PRMT"
    const matchedStock = Object.entries(stockDataRaw).find(([key]) => {
      return key.toLowerCase() === `inv_${customerLocation.toLowerCase()}`;
    });

    const stockAvailable = matchedStock ? Number(matchedStock[1]) : 0;

    // ✅ Update state
    setAskedProduct((prev) => {
      const exists = prev?.find((p) => p.No === prod.No);

      if (exists) {
        return prev?.map((p) =>
          p.No === prod.No ? { ...p, qty: p.qty + 1 } : p
        );
      }

      return [
        ...prev,
        {
          ...prod,
          qty: 1,
          priceGroupKey: targetKey,
          price: matchedPrice,
          stockAvailable: stockAvailable + " - " + customerLocation, // ✅ hanya stok yang match
          selectedForSalesOrder: false,
        },
      ];
    });

    setProductSearch("");
  };

  // note: product yang duplikat akan ditimpa
  const handleAddToSalesOrder = () => {
    const askedProductOn = askedProduct.filter(
      (p) => p.selectedForSalesOrder === true
    );

    const remainingUniqueSalesOrderProd = salesOrder.products.filter(
      (p) => !askedProductOn.some((ap) => ap.No === p.No)
    );

    setSalesOrder((prev) => ({
      ...prev,
      products: [...remainingUniqueSalesOrderProd, ...askedProductOn],
    }));

    setAskedProduct([]);
    document.getElementById("only-ask").close();
  };

  //listener to keydown escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setProductSearch("");
        document.getElementById("only-ask").close();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!isFocusedProduct) {
      // Delay sedikit agar klik list tidak langsung hilang
      const timeout = setTimeout(() => {
        setProductSearch("");
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isFocusedProduct]);

  useEffect(() => {
    setActiveProductOptionIdx(-1); // Reset highlight when list changes
  }, [productList]);

  //untuk enter ketika dipilih melalui arrow down
  const handleKeyDown = (e) => {
    if (!productList?.data || productList.data.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveProductOptionIdx((prev) =>
        prev < productList.data.length - 1 ? prev + 1 : 0
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveProductOptionIdx((prev) =>
        prev > 0 ? prev - 1 : productList.data.length - 1
      );
    }

    if (e.key === "Enter" || e.key === "Tab") {
      if (activeProductOptionIdx >= 0) {
        e.preventDefault();
        addProduct(productList.data[activeProductOptionIdx]);
      }
    }
  };

  return (
    <dialog id="only-ask" className="modal">
      <Toaster position="top-center" />
      <div className="modal-box md:min-w-[600px] backdrop">
        <h3 className="font-bold title text-3xl mb-4 text-center">
          Diskusi Produk
        </h3>
        <div className="space-y-2   flex items-center gap-x-3">
          <div className="flex flex-col w-full ">
            <Input
              disabled={salesOrder.customer?.No ? false : true}
              placeholder="Cari Produk (min 2 huruf)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="rounded-md"
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocusedProduct(true)}
              onBlur={() => setIsFocusedProduct(false)}
            />
            {productList?.data?.length > 0 && (
              <ul className="backdrop ">
                {productList.data?.map((prod, index) => (
                  <li key={prod._id}>
                    <button
                      className={`w-full  text-left px-4 py-2 ${
                        index === activeProductOptionIdx
                          ? "bg-accent"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => addProduct(prod)}
                    >
                      ({prod.No})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* 🛒 Daftar Produk */}
        {askedProduct?.length > 0 && (
          <Card className="mt-4">
            <CardContent className="p-4  space-y-4">
              <h3 className="text-lg  font-semibold mb-2">🛒 Daftar Produk</h3>
              <ScrollArea className="max-h-80 overflow-y-auto pr-2">
                <div className="space-y-3">
                  {askedProduct?.map((prod) => (
                    <div
                      key={prod.No}
                      className="bg-white border-t-4 border-black border-dashed dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-5 mb-4 flex flex-col md:flex-row justify-between gap-5 dark:border-gray-700"
                    >
                      {/* Product Item */}
                      <Item
                        prod={prod}
                        updateProductQty={(qty) => {
                          setAskedProduct((prev) =>
                            prev.map((p) =>
                              p.No === prod.No ? { ...p, qty } : p
                            )
                          );
                        }}
                        setManualQty={(qty) => {
                          setAskedProduct((prev) =>
                            prev.map((p) =>
                              p.No === prod.No ? { ...p, qty } : p
                            )
                          );
                        }}
                        removeProduct={() => {
                          setAskedProduct((prev) =>
                            prev.filter((p) => p.No !== prod.No)
                          );
                        }}
                        selectedLocationCode={locationCode}
                      />

                      {/* Checkbox */}
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-accent"
                          checked={prod.selectedForSalesOrder}
                          onChange={() => {
                            setAskedProduct((prev) =>
                              prev.map((p) =>
                                p.No === prod.No
                                  ? {
                                      ...p,
                                      selectedForSalesOrder:
                                        !p.selectedForSalesOrder,
                                    }
                                  : p
                              )
                            );
                          }}
                        />
                        <span className="text-sm">Pilih</span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <div className="modal-action">
          <button
            disabled={
              salesOrder?.customer?.No &&
              Array.isArray(askedProduct) &&
              askedProduct.some((p) => p?.selectedForSalesOrder)
                ? false
                : true
            }
            className="btn flex-1 bg-orange-400 rounded-lg text-white font-semibold"
            onClick={handleAddToSalesOrder}
          >
            Tambah product Terpilih ke Sales Order
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-2 bg-gray-100 p-2 rounded-lg">
          note: product yang duplikat akan ditimpa
        </p>
        <p className="text-sm text-gray-600 mt-2">ESC to close</p>
      </div>
    </dialog>
  );
};

export default OnlyAsk;
