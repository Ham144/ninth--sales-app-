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
const ModalShowStock = ({ No }) => {
  const { data, isPending } = useQuery({
    queryKey: ["showStock", No],
    queryFn: () => ProductApi.getStockByNo(No),
    enabled: !!No,
  });

  console.log(data);

  const stockData = data?.data?.[0]
    ? Object.entries(data.data[0])
        .filter(([key]) => key.toLowerCase().startsWith("inv_"))
        .map(([key, value]) => ({
          name: key.replace(/^Inv_/, ""), // hapus prefix "Inv_"
          value,
        }))
    : [];

  console.log(stockData);

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
              <div className="grid grid-cols-2 gap-y-1 mt-4 text-sm">
                {stockData.map(({ name, value }, i) => (
                  <React.Fragment key={name}>
                    <div
                      className={`px-2 py-1 ${
                        i % 2 === 0 ? "bg-gray-100" : "bg-white"
                      } text-gray-800 font-semibold rounded-l`}
                    >
                      {name}
                    </div>
                    <div
                      className={`px-2 py-1 text-right font-mono ${
                        i % 2 === 0 ? "bg-gray-50" : "bg-white"
                      } text-gray-900 rounded-r`}
                    >
                      {value}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </AlertDialogDescription>
        )}
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel className="text-white">Tutup</AlertDialogCancel>
        <AlertDialogAction className="text-white">Ok</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
};

export default ModalShowStock;
