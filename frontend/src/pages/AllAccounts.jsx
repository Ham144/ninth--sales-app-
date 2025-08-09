import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { getAllAccount, updateUser } from "@/api/authApi";
import { LucideShieldQuestion } from "lucide-react";
import { toast } from "sonner";

const AllAccounts = () => {
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [filteredAccounts, setFilteredAccounts] = useState([]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [uniqueRoles, setUniqueRoles] = useState([]);

  const queryClient = useQueryClient();
  const { data: spgList } = useQuery({
    queryFn: getAllSpg,
    queryKey: ["spg"],
  });
  const { data: outletList } = useQuery({
    queryFn: getOuletList,
    queryKey: ["outlet"],
  });
  const { mutateAsync: handleUpdateSpg } = useMutation({
    mutationFn: async () => {
      const body = {
        id: selectedUser?._id,
        name: selectedUser?.username,
        telepon: selectedUser?.telepon,
        email: selectedUser?.email,
        targetHargaPenjualan: selectedUser?.targetHargaPenjualan,
        targetQuantityPenjualan: selectedUser?.targetQuantityPenjualan,
      };
      await editSpg(body);
    },
    mutationKey: ["spg", "user"],
    onSuccess: () => {
      queryClient.invalidateQueries("spg");
      toast.success("Account updated successfully!");
      setSelectedUser(null);
      setShowEditForm(false);
    },
  });
  const { data: userList } = useQuery({
    queryFn: getAllAccount,
    queryKey: ["user"],
  });

  const { mutateAsync: handleDeleteUserKasir } = useMutation({
    mutationFn: (userId) => deleteKasir(userId),
    mutationKey: ["kasir", "user"],
    onSuccess: () => {
      setSelectedUser(null);
      queryClient.invalidateQueries("kasir");
      toast.success("Account deleted successfully!");
    },
    onError: (err) => {
      toast(err?.response?.data?.message || err.message);
    },
  });

  const { mutateAsync: handleUpdateUser } = useMutation({
    mutationFn: () => updateUser(selectedUser),
    onSuccess: () => {
      queryClient.invalidateQueries(["kasir", "user"]);
      setShowEditForm(false);
      setSelectedUser(null);
      toast.success("Edited successfully!");
    },
    onError: (err) => {
      toast(err?.response?.data?.message || err.message);
    },
  });

  const { mutateAsync: handleDeleteSpg } = useMutation({
    mutationFn: async (spgId) => await deleteSpg(spgId),
    mutationKey: ["spg"],
    onError: (error) => {
      toast.error(error?.response?.data?.message);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries(["spg"]);
      toast.success(res?.response?.data?.message || res.message);
      setSelectedUser(null);
      setShowEditForm(false);
    },
  });

  const { mutateAsync: handleAssignOutlet } = useMutation({
    mutationFn: ({ userId, outletId }) => assignUserToOutlet(userId, outletId),
    onSuccess: () => {
      queryClient.invalidateQueries(["outlet"]);
      toast.success("User assigned to outlet successfully");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "Failed to assign user to outlet"
      );
    },
  });

  const findOutletForUser = (userId, outletList) => {
    if (!outletList || !userId) return null;

    const outlet = outletList.find(
      (outlet) => outlet.kasirList && outlet.kasirList.includes(userId)
    );

    return outlet || null;
  };

  const handleEditClick = (user) => {
    setSelectedUser(null);

    setTimeout(() => {
      const userOutlet = findOutletForUser(user._id, outletList?.data || []);

      setSelectedUser({
        _id: user._id,
        username: user?.username || user?.name,
        password: "",
        email: user?.email || "",
        telepon: user?.telepon || "",
        targetHargaPenjualan: user?.targetHargaPenjualan || 0,
        targetQuantityPenjualan: user?.targetQuantityPenjualan || 0,
        outlet: userOutlet ? userOutlet._id : "",
        roleName: user?.roleName || "",
        blockedAccess: user?.blockedAccess || [],
        kodeKasir: user?.kodeKasir || "",
      });
    }, 0);
    setShowEditForm(true);
  };

  const handleDownloadAsCsv = () => {
    if (!filteredAccounts) {
      return toast("tidak ada data untuk didownload");
    }
    const csvRows = [];
    const headers = [
      "username",
      "kodeKasir",
      "email",
      "telepon",
      "targetHargaPenjualan",
      "targetQuantityPenjualan",
      "outlet",
      "roleName",
    ];
    csvRows.push(headers.join(","));
    filteredAccounts.forEach((user) => {
      const row = [
        user.username || user.name,
        user.kodeKasir || "-",
        user.email,
        user.telepon,
        user.targetHargaPenjualan,
        user.targetQuantityPenjualan,
        user.outlet,
        user.roleName,
      ];
      csvRows.push(row.join(","));
    });
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "allAccounts.csv");
    link.click();
  };

  useEffect(() => {
    const allSpg = spgList?.data.map((spg) => ({
      ...spg,
      type: "SPG",
    }));
    const all = [...(userList?.data || []), ...(allSpg || [])];
    setAllAccounts(all);

    // Extract unique roles
    const roles = new Set(all.map((account) => account.roleName || "SPG"));
    setUniqueRoles(Array.from(roles));

    // Apply current role filter
    filterAccountsByRole(selectedRole, all);
  }, [userList, spgList, selectedRole]);

  const filterAccountsByRole = (role, accounts = allAccounts) => {
    if (role === "all") {
      setFilteredAccounts(accounts);
    } else {
      const filtered = accounts.filter(
        (account) => (account.roleName || "SPG") === role
      );
      setFilteredAccounts(filtered);
    }
  };

  const toggleBlockedAccess = (page) => {
    setSelectedUser((prev) => {
      const blockedAccess = prev.blockedAccess || [];
      if (blockedAccess.includes(page)) {
        return {
          ...prev,
          blockedAccess: blockedAccess.filter((item) => item !== page),
        };
      } else {
        return {
          ...prev,
          blockedAccess: [...blockedAccess, page],
        };
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col items-start p-4 ">
      <div className="flex flex-1 w-full">
        <div className="flex-1 w-full h-full p-6 rounded-lg shadow-lg bg-white">
          <div className="flex flex-1 w-full overflow-auto">
            <div className="mb-4 w-full">
              <div className="flex gap-x-4 justify-between items-center">
                <div className="flex gap-x-4 items-center">
                  <button
                    onClick={() => {
                      setShowEditForm(false);
                      setSelectedUser(null);
                      document.getElementById("newAccount").showModal();
                    }}
                    className="btn bg-primary text-white"
                  >
                    Initialize New Account
                  </button>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="select select-bordered w-full max-w-xs"
                  >
                    <option value="all">All Roles</option>
                    {uniqueRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-x-2 items-center">
                  <button
                    onClick={handleDownloadAsCsv}
                    className="btn bg-secondary"
                  >
                    Download as Csv
                  </button>
                  <button className="btn bg-secondary">
                    Length: {filteredAccounts.length}
                  </button>
                </div>
              </div>
              <table className="w-full mt-4 border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 text-left">
                      Username{" "}
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="untuk login"
                      >
                        <LucideShieldQuestion className="w-4 h-4" />
                      </span>
                    </th>
                    <th className="p-2 text-left">
                      Kode Kasir{" "}
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="untuk format kodeInvoice"
                      >
                        <LucideShieldQuestion className="w-4 h-4" />
                      </span>
                    </th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Telepon</th>
                    <th className="p-2 text-right">Target Penjualan</th>
                    <th className="p-2 text-center">Target Quantity</th>
                    <th className="p-2 text-center">Outlet</th>
                    <th className="p-2 text-center">Role</th>
                  </tr>
                </thead>
                <tbody className="border">
                  {filteredAccounts?.map((user) => (
                    <tr
                      key={user._id}
                      onClick={() => handleEditClick(user)}
                      className="hover:bg-gray-100 cursor-pointer"
                    >
                      <td className="p-2">
                        {user.username || user.name || "N/A"}
                      </td>
                      <td className="p-2 font-mono">{user.kodeKasir || "-"}</td>
                      <td className="p-2">{user.email || "-"}</td>
                      <td className="p-2">{user.telepon || "N/A"}</td>
                      <td className="p-2 text-right">
                        {Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        }).format(user.targetHargaPenjualan) || "-"}
                      </td>
                      <td className="p-2 text-center">
                        {user.targetQuantityPenjualan || "-"}
                      </td>
                      <td className="p-2 text-center">
                        {(() => {
                          const outlet = findOutletForUser(
                            user._id,
                            outletList?.data || []
                          );
                          return outlet ? outlet.namaOutlet : "-";
                        })()}
                      </td>
                      <td className="p-2 text-center">
                        {user.roleName || "SPG"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showEditForm && selectedUser && (
          <div className="w-[400px] ml-8 bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-800 ">Edit User</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedUser.type == "SPG") {
                  handleUpdateSpg();
                } else {
                  handleUpdateUser();
                }
              }}
              className="space-y-5"
            >
              <div className="flex pb-3 justify-end gap-4 pt-4">
                <button
                  type="button"
                  className="bg-gray-400 flex-1 hover:bg-gray-500 text-white px-4 py-2 rounded-lg transition-all"
                  onClick={() => setShowEditForm(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="bg-red-400 flex-1 hover:bg-red-500 text-white px-4 py-2 rounded-lg transition-all"
                  onClick={() => {
                    const confirmDelete = window.confirm(
                      `Apakah Anda yakin ingin menghapus ${selectedUser.username}?`
                    );
                    if (confirmDelete) {
                      if (selectedUser.type == "SPG") {
                        handleDeleteSpg(selectedUser._id);
                      } else {
                        handleDeleteUserKasir(selectedUser._id);
                      }
                    }
                  }}
                >
                  Hapus
                </button>
                <button
                  type="submit"
                  className="bg-primary text-white px-6 py-2 rounded-lg transition-all"
                >
                  Perbarui
                </button>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
                  Username
                  <div
                    className="tooltip tooltip-bottom"
                    data-tip="Maaf. Tidak boleh diubah, sudah terlanjur penghubung (FK) antar Invoice"
                  >
                    <LucideShieldQuestion className="w-4 h-4" />
                  </div>
                </label>
                <input
                  type="text"
                  disabled
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.username || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Kode Kasir{" "}
                  <span className="badge badge-info text-xs">
                    Max 3 karakter
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.kodeKasir || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      kodeKasir: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Masukkan kode kasir (3 karakter)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Kode ini muncul dalam kode invoice dan harus unik (3 karakter)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.password || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Enter new password (leave blank to keep current)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.email || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Telepon
                </label>
                <input
                  type="text"
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.telepon || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      telepon: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Target Harga Penjualan
                </label>
                <input
                  type="number"
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.targetHargaPenjualan || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      targetHargaPenjualan: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Target Quantity Penjualan
                </label>
                <input
                  type="number"
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.targetQuantityPenjualan || ""}
                  onChange={(e) =>
                    setSelectedUser((prev) => ({
                      ...prev,
                      targetQuantityPenjualan: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Outlet
                </label>
                <select
                  className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedUser.outlet || ""}
                  onChange={(e) => {
                    const newOutletId = e.target.value;
                    setSelectedUser((prev) => ({
                      ...prev,
                      outlet: newOutletId,
                    }));

                    // Immediately update the outlet assignment
                    if (selectedUser._id) {
                      handleAssignOutlet({
                        userId: selectedUser._id,
                        outletId: newOutletId,
                      });
                    }
                  }}
                >
                  <option value="">Pilih Outlet</option>
                  {outletList?.data?.map((outlet) => (
                    <option key={outlet._id} value={outlet._id}>
                      {outlet.namaOutlet}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser?.type !== "SPG" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Role Name
                    </label>
                    <input
                      type="text"
                      className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500"
                      value={selectedUser.roleName?.toUpperCase() || ""}
                      onChange={(e) =>
                        setSelectedUser((prev) => ({
                          ...prev,
                          roleName: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>

                  <div className="divider divider-neutral">
                    Atau Lebih Spesifik
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </div>
      <ModalNewAccount key="newAccount" />
    </div>
  );
};

export default AllAccounts;
