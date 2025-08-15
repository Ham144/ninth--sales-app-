import React from "react";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import ProductApi from "@/api/productApi";
const ModalShowStock = ({ No, customer }) => {
  const { data, isPending } = useQuery({
    queryKey: ["showStock", No],
    queryFn: () => ProductApi.getStockByNo(No),
    enabled: !!No,
  });

  const stockData = data?.data?.[0]
    ? Object.entries(data.data[0])
        .filter(([key]) => key.toLowerCase().startsWith("inv_"))
        .map(([key, value]) => ({
          name: key.replace(/^Inv_/, ""), // hapus prefix "Inv_"
          value,
        }))
    : [];

  const specificQuantityByLocationCode = stockData.find(
    (item) => item.name === customer._x003C_Area_x003E_
  );

  return (
    <AlertDialogContent className="max-w-lg backdrop-blur-lg">
      <AlertDialogHeader>
        <AlertDialogTitle className="text-lg font-bold text-white">
          {No}
        </AlertDialogTitle>
        {isPending ? (
          <div className="flex justify-center items-center py-6">
            <span className="loading loading-ring loading-lg"></span>
          </div>
        ) : (
          <AlertDialogDescription asChild>
            {stockData.length === 0 ? (
              <p className="text-gray-600">Tidak ada data stok.</p>
            ) : (
              <div className="grid text-white grid-cols-2 gap-y-1 mt-4 text-sm">
                <React.Fragment key={specificQuantityByLocationCode.name}>
                  <div
                    className={`px-2 py-1text-gray-800 font-semibold rounded-l`}
                  >
                    {specificQuantityByLocationCode.name}
                  </div>
                  <div className={`px-2 py-1 text-right font-mono  rounded-r`}>
                    {specificQuantityByLocationCode.value}
                  </div>
                </React.Fragment>
              </div>
            )}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogAction className="text-white">Ok</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
};

export default ModalShowStock;
