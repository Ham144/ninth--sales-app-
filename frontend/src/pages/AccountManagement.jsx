import PengelolaSideBarMenu from "@/components/PengelolasSideBarMenu";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllAccount,
  updateUser,
  createAppUser,
  deleteAppUser,
} from "@/api/authApi";
import { Pencil, Plus, TrashIcon } from "lucide-react";
import { toast } from "sonner";

// Penjelasan Akun
// ----------------------------------------
// - supertenant: Hanya satu akun utama sistem. Bisa berpindah antar organisasi (tenant),
//   membuat tenant baru, tidak terikat dengan LDAP. Digunakan oleh developer/admin utama.
// - owner: Admin organisasi/tenant. Bisa berasal dari login LDAP (automatis) atau dibuat manual (authMethod 'app').
// - member: Pengguna biasa. Bisa dari LDAP (otomatis join) atau dibuat manual (authMethod 'app').
//
// authMethod === 'app'  => username, email, password bisa diubah.
// authMethod === 'ldap' => hanya bisa ubah role (owner/member), tidak bisa ubah username/password.

export default function AccountManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    _id: "",
    username: "",
    email: "",
    password: "",
    role: "member",
    isDisabled: false,
    authMethod: "app",
  });
  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getAllAccount,
  });

  const { mutate: handleUpdateUser, isPending: isUpdating } = useMutation({
    mutationFn: () => updateUser(formData),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      toast.success("User berhasil diperbarui");
      handleCloseDialog();
      setSelectedUserId(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Gagal memperbarui user");
    },
  });
  const { mutate: handleDelete } = useMutation({
    mutationFn: async () => deleteAppUser(selectedUserId),
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      toast.success("User berhasil dihapus");
      document.getElementById("confirm-delete")?.close();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Gagal memperbarui user");
    },
  });

  const { mutate: handleCreateAppUser } = useMutation({
    mutationFn: createAppUser,
    onSuccess: () => {
      queryClient.invalidateQueries(["users"]);
      toast.success("User berhasil diperbarui");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Gagal memperbarui user");
    },
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setIsEditMode(false);
    setFormData({
      _id: "",
      username: "",
      email: "",
      password: "",
      role: "member",
      isDisabled: false,
      authMethod: "app",
    });
    setErrors({});
    setSelectedUserId(null);
  };

  const handleEdit = (user) => {
    setIsEditMode(true);
    setFormData({
      _id: user._id,
      username: user.username,
      email: user.email || "",
      password: "",
      role: user.role,
      isDisabled: user.isDisabled,
      authMethod: user.authMethod,
      _2faIsVerified: user._2faIsVerified || false,
    });
    setIsOpen(true);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username) {
      newErrors.username = "Username diperlukan";
    }

    if (!isEditMode || (isEditMode && formData.password)) {
      if (!formData.password && !isEditMode && formData.authMethod === "app") {
        newErrors.password = "Password diperlukan";
      } else if (formData.password) {
        const password = formData.password;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const isLongEnough = password.length >= 3;

        if (!isLongEnough) {
          newErrors.password = "Password harus lebih dari 3 karakter";
        } else if (!hasUpperCase) {
          newErrors.password = "Password harus memiliki huruf besar";
        } else if (!hasNumber) {
          newErrors.password = "Password harus memiliki angka";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updateData = { ...formData };
    if (validateForm()) {
      if (isEditMode) {
        if (formData?.authMethod === "ldap") {
          if (!updateData.password) delete updateData.password;
          handleUpdateUser(updateData);
        } else {
          if (!updateData.password) delete updateData.password;
          handleUpdateUser(updateData);
        }
      } else {
        if (!updateData.password) delete updateData.password;
        handleCreateAppUser(updateData);
      }
    }
  };

  useEffect(() => {
    if (!users?.data) return;

    const filteredFrontend = users.data.filter((user) => {
      if (
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return true;
      }
    });

    setFilteredUsers(filteredFrontend);
  }, [users?.data, searchTerm]);

  function handleOpenDialog() {
    setIsOpen(true);
    setIsEditMode(false);
    setFormData({
      _id: "",
      username: "",
      email: "",
      password: "",
      role: "member",
      isDisabled: false,
      authMethod: "app",
    });
    setErrors({});
  }

  return (
    <PengelolaSideBarMenu>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl rounded-md font-light">Account Management</h1>
          <button
            onClick={handleOpenDialog}
            className="btn bg-orange-500 rounded-lg text-white font-medium"
          >
            <Plus className="h-5 w-5 mr-1" />
            Tambah User (non ldap)
          </button>
        </div>

        {/* Dialog for Add/Edit User */}
        {isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto max-md:py-32">
            <div className="backdrop p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-light text-center  mb-4">
                {isEditMode ? "Edit User" : "Tambah User non ldap (app)"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Auth Method Selection */}
                {!isEditMode && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Metode Autentikasi</span>
                    </label>
                    <select
                      value={formData.authMethod}
                      disabled
                      className="select select-bordered"
                    >
                      <option value="app">Manual (App)</option>
                    </select>
                    <label className="label">
                      <span className="label-text-alt">
                        {formData.authMethod === "ldap"
                          ? "User akan login menggunakan credential LDAP"
                          : "User akan dibuat manual dalam sistem"}
                      </span>
                    </label>
                  </div>
                )}
                {/* Username Field */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Username</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    autoComplete="off"
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className={`input backdrop input-bordered ${
                      errors.username ? "input-error" : ""
                    }`}
                    placeholder="Masukkan username"
                    disabled={isEditMode && formData.authMethod === "ldap"}
                  />
                  {errors.username && (
                    <span className="text-error text-sm mt-1">
                      {errors.username}
                    </span>
                  )}
                </div>{" "}
                {/* Password Field (only for app auth) */}
                {(!isEditMode || formData.authMethod === "app") && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Password</span>
                    </label>
                    <input
                      type="password"
                      value={formData?.password || ""}
                      autoComplete="off"
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className={`input backdrop input-bordered ${
                        errors.password ? "input-error" : ""
                      }`}
                      placeholder="Masukkan Password baru, atau biarkan"
                      disabled={isEditMode && formData.authMethod === "ldap"}
                    />
                    {errors.password && (
                      <span className="text-error text-sm mt-1">
                        {errors.password}
                      </span>
                    )}
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Email</span>
                  </label>
                  <input
                    type="email"
                    value={formData?.email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`input backdrop input-bordered ${
                      errors.email ? "input-error" : ""
                    }`}
                    placeholder="Masukkan Email"
                  />
                  {errors.email && (
                    <span className="text-error text-sm mt-1">
                      {errors.email}
                    </span>
                  )}
                </div>
                {/* Password Field (only for new app auth) */}
                {isEditMode && formData.authMethod === "app" && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Password</span>
                    </label>
                    <input
                      type="password"
                      value={formData.password || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className={`input backdrop input-bordered ${
                        errors.password ? "input-error" : ""
                      }`}
                      placeholder="Masukkan password"
                    />
                    {errors.password && (
                      <span className="text-error text-sm mt-1">
                        {errors.password}
                      </span>
                    )}
                  </div>
                )}
                {/* Role Selection */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Role</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="select backdrop select-bordered"
                    disabled={
                      formData.authMethod === "ldap" &&
                      formData.role === "supertenant"
                    }
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                    <option disabled value="supertenant">
                      supertenant
                    </option>
                    {formData?.role === "supertenant" && (
                      <option value="supertenant">Supertenant</option>
                    )}
                  </select>
                  <label className="label">
                    <span className="label-text-alt">
                      {formData?.role === "supertenant"
                        ? "Akses penuh ke semua tenant"
                        : formData?.role === "owner"
                        ? "Admin untuk tenant saat ini"
                        : "User biasa dengan akses terbatas"}
                    </span>
                  </label>
                </div>
                {isEditMode && (
                  <div className="form-control ">
                    <label className="label">
                      <span className="label-text">Fitur 2FA</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={formData?._2faIsVerified || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          _2faIsVerified: e.target.checked,
                        })
                      }
                      className="checkbox"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    className="btn btn-ghost"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary text-white rounded-md"
                    disabled={isUpdating}
                  >
                    {isUpdating
                      ? isEditMode
                        ? "Menyimpan..."
                        : "Membuat..."
                      : isEditMode
                      ? "Simpan Perubahan"
                      : "Buat User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Table */}
        <div className="overflow-x-auto backdrop dark:bg-gray-800 shadow-xl rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari user..."
                className="input backdrop rounded-md input-bordered input-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total: {filteredUsers.length} users
            </div>
          </div>

          <table className="table w-full text-left table-auto">
            {/* Table Header */}
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider rounded-tl-lg">
                  No
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                  Auth Method
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider rounded-tr-lg">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-gray-500 dark:text-gray-400"
                  >
                    <span className="loading loading-spinner loading-md text-blue-500 mr-2"></span>
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers && filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => (
                  <tr
                    key={user._id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  >
                    <th className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {index + 1}
                    </th>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        {user.username}
                        {user?.role === "supertenant" && (
                          <span className="badge badge-warning badge-xs">
                            SUPER
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {user.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 capitalize">
                      <span
                        className={`badge ${
                          user?.role === "supertenant"
                            ? "badge-warning"
                            : user?.role === "owner"
                            ? "badge-primary"
                            : "badge-ghost"
                        }`}
                      >
                        {user?.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-xs font-semibold px-2 py-1 rounded-full ${
                          user.authMethod === "ldap"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {user.authMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            handleEdit(user);
                            setIsEditMode(true);
                          }}
                          className="btn btn-ghost btn-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 tooltip tooltip-top"
                          data-tip="Edit User"
                          disabled={user?.role === "supertenant"}
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              user?.role === "supertenant" ||
                              (user.authMethod === "ldap" &&
                                user?.role === "owner")
                            ) {
                              toast.error(
                                "Menghapus user authMethod= 'LDAP' tidak berdampak apa-apa, disable user di LDAP"
                              );
                            } else {
                              setSelectedUserId(user._id);
                              document
                                .getElementById("confirm-delete")
                                .showModal();
                            }
                          }}
                          className="btn btn-ghost btn-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 tooltip tooltip-top"
                          data-tip="Delete User"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-6 text-gray-500 dark:text-gray-400"
                  >
                    Tidak ada user yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <dialog id="confirm-delete" className="modal">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Konfirmasi!</h3>
            <p className="py-4">Apakah anda yakin Menghapus</p>
            <div className="modal-action">
              <form method="dialog " className="gap-x-2 flex">
                <button className="btn">Batal</button>
                <button
                  className="btn"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                >
                  Ya, Hapus
                </button>
              </form>
            </div>
          </div>
        </dialog>
      </div>
    </PengelolaSideBarMenu>
  );
}
