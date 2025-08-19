import React from "react";

const ModalTempOption = ({
  setFrontendSession,
  setSalesOrder,
  tempSalesOrderOption,
  setTempSalesOrderOption,
}) => {
  return (
    <dialog id="modal-temp-so" className="modal">
      <div className="modal-box w-11/12 max-w-5xl">
        <h3 className="font-bold text-lg">Pilih Temporary Sales Order</h3>
        <p className="py-2 text-sm text-gray-600">
          Berikut adalah daftar temporary sales order yang tersedia:
        </p>

        <div className="overflow-y-auto max-h-[60vh] mt-4">
          {tempSalesOrderOption.map((order, index) => (
            <div key={order._id} className="card bg-base-100 shadow-md mb-4">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{order.comment}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="btn btn-sm bg-orange-400 text-white rounded-lg"
                    onClick={() => {
                      setFrontendSession(order.frontendSession);
                      setSalesOrder((prev) => ({
                        ...prev,
                        products: order.products,
                      }));
                      setTempSalesOrderOption([]);
                      document.getElementById("modal-temp-so").close();
                    }}
                  >
                    Pilih
                  </button>
                </div>

                <div className="divider my-2"></div>

                <div className="overflow-x-auto">
                  <table className="table table-zebra table-sm">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Deskripsi</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Harga</th>
                        <th className="text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((product) => (
                        <tr key={product._id}>
                          <td>{product.No}</td>
                          <td>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {product.Description}
                              </span>
                              <span className="text-xs text-gray-500">
                                {product.Description_2}
                              </span>
                            </div>
                          </td>
                          <td className="text-right">{product.qty}</td>
                          <td className="text-right">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                            }).format(parseFloat(product.price))}
                          </td>
                          <td className="text-right">
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                            }).format(product.qty * parseFloat(product.price))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan="4" className="text-right">
                          Total
                        </th>
                        <th className="text-right">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                          }).format(
                            order.products.reduce(
                              (sum, product) =>
                                sum + product.qty * parseFloat(product.price),
                              0
                            )
                          )}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button className="btn" onClick={() => setTempSalesOrderOption([])}>
              Tutup
            </button>
          </form>
        </div>
      </div>

      {/* Backdrop click to close */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={() => setTempSalesOrderOption([])}>close</button>
      </form>
    </dialog>
  );
};

export default ModalTempOption;
