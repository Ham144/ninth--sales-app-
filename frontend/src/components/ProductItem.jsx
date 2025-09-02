import ProductApi from "@/api/productApi";
import { useQuery } from "@tanstack/react-query";
import React from "react";

const ProductItem = ({ product, handleProductClick, locationCode }) => {
  const { data: productStock, isLoading: isStockLoading } = useQuery({
    queryKey: ["product-stock", product.No, locationCode],
    queryFn: () =>
      ProductApi.getStockByNo({
        No: product.No,
        locationCode,
      }),
    enabled: !!locationCode && !!product.No,
  });

  if (isStockLoading) {
    return (
      <tr className="w-full">
        <span className="loading loading-spinner loading-lg"></span>
      </tr>
    );
  }

  return (
    <tr
      key={product._id}
      className="hover:bg-gray-50 text-center cursor-pointer transition-colors"
      onClick={() => handleProductClick(product)}
    >
      <td className="font-mono text-sm">{product.No}</td>
      <td>
        <div>
          <div className="font-medium text-gray-900">{product.Description}</div>
          <div className="text-sm text-gray-500">{product.Description_2}</div>
        </div>
      </td>
      <td>
        {locationCode ? (
          <span className="badge font-bold text-center  badge-outline badge-primary">
            {productStock?.stockResult || 0}
          </span>
        ) : (
          <span className="font-bold text-center  badge-outline badge-primary">
            Pilih location
          </span>
        )}
      </td>
      <td>
        <span className="badge max-md:hidden badge-outline badge-primary">
          {product._x003C_Brand_x003E_ || product.Manufacturer_Code || "-"}
        </span>
      </td>
      <td>
        <span className="badge max-md:hidden badge-outline badge-secondary">
          {product.Item_Category_Code}
        </span>
      </td>
    </tr>
  );
};

export default ProductItem;
