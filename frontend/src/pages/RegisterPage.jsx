import { register } from "@/api/authApi";
import { APP_NAME } from "@/api/constant";
import OrgApi from "@/api/orgApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogIn, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export const initialOrg = {
  AD_HOST: "",
  AD_PORT: "",
  organizationName: "",
};
export default function RegisterPage() {
  const [username, setUsername] = useState();
  const [password, setPassword] = useState();
  const [email, setEmail] = useState();
  const [newOrg, setNewOrg] = useState(initialOrg);
  const [selectedOrg, setSelectedOrg] = useState(""); //hanya _id
  const [isSelectNotCreate, setIsSelectNotCreate] = useState(true);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const { data: searchResult } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const res = await OrgApi.getAllOrg(search);
      return res.data;
    },
    enabled: !!search,
  });

  const { mutateAsync: handleRegister, isPending: isVerifying } = useMutation({
    mutationKey: ["register", "auth"],
    mutationFn: async () => {
      const data = await register({
        username,
        password,
        email,
        newOrg,
        selectedOrg,
      });
      return data;
    },
    onSuccess: (res) => {
      toast.success(res?.response?.data?.message || "Berhasil");
      toast.loading("proses registration berlangsung..");
      setTimeout(() => {
        navigate(`/`);
        toast.dismiss();
      }, 1000);
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || "Terhadi kesalahan registrasi"
      );
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-4xl rounded-xl overflow-hidden shadow-2xl bg-white dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Form Section */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
            }}
            className="p-8 md:p-12 space-y-6"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 mb-2">
                {APP_NAME}
              </h1>
              <p className="text-balance text-lg text-gray-700 dark:text-gray-300">
                Selamat datang! Silakan daftar untuk melanjutkan.
              </p>
              <p className="mt-3 px-4 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full font-medium">
                Gunakan Kredensial LDAP CSI Anda
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1"
                >
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                  placeholder="Masukkan username Anda"
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  disabled={isVerifying}
                />
              </div>
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1"
                >
                  Email{" "}
                </label>
                <div className="form-control w-full ">
                  <input
                    id="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Masukkan Email Anda"
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    disabled={isVerifying}
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      Untuk pengiriman notifikasi form request untuk anda
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  placeholder="Masukkan password Anda"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  disabled={isVerifying}
                />
              </div>
              {/* === PILIH ATAU DAFTARKAN ORGANISASI === */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Organisasi
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewOrg(initialOrg);
                      setIsSelectNotCreate(true);
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all duration-200
        ${
          isSelectNotCreate
            ? "bg-blue-600 text-white shadow-md"
            : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
        }
      `}
                  >
                    🔍 Join Organisasi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrg("");
                      setIsSelectNotCreate(false);
                      setSearch("");
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all duration-200
        ${
          !isSelectNotCreate
            ? "bg-blue-600 text-white shadow-md"
            : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
        }
      `}
                  >
                    🏢 Daftarkan Baru
                  </button>
                </div>

                {isSelectNotCreate ? (
                  <>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mt-2">
                      Cari Nama Organisasi
                    </label>
                    <div className="flex relative ">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input rounded-lg input-bordered w-full"
                        placeholder="Contoh: PT Inovasi Teknologi"
                      />
                      <div className="absolute right-2 top-[50%] translate-y-[-50%]">
                        <Search />
                      </div>
                    </div>
                    {/* Hasil Pencarian */}
                    {searchResult?.length > 0 ? (
                      <ul className="border border-gray-300 dark:border-gray-700 rounded-lg mt-2 overflow-y-auto max-h-40 divide-y divide-gray-200 dark:divide-gray-700">
                        {searchResult.map((org) => (
                          <li
                            key={org._id}
                            onClick={() => {
                              setSelectedOrg(org);
                              setSearch(org.organizationName);
                            }}
                            className={`p-3 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer transition-all ${
                              selectedOrg._id === org._id
                                ? "bg-blue-50 dark:bg-blue-800"
                                : ""
                            }`}
                          >
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {org.organizationName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {org._id}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      search && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Organisasi tidak ditemukan. Coba nama lain atau
                          daftarkan baru.
                        </p>
                      )
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm text-gray-600 dark:text-gray-300 mt-2 mb-1">
                      Nama Organisasi
                    </label>
                    <input
                      type="text"
                      value={newOrg.organizationName}
                      onChange={(e) =>
                        setNewOrg({
                          ...newOrg,
                          organizationName: e.target.value,
                        })
                      }
                      className="input input-bordered w-full mb-3"
                      placeholder="Contoh: Catur Sukses Internasional"
                    />

                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      LDAP Host (AD_HOST)
                    </label>
                    <input
                      type="text"
                      value={newOrg.AD_HOST}
                      onChange={(e) =>
                        setNewOrg({ ...newOrg, AD_HOST: e.target.value })
                      }
                      className="input input-bordered w-full mb-3"
                      placeholder="contoh: ldap.perusahaan.com"
                    />

                    <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                      LDAP Port (AD_PORT)
                    </label>
                    <input
                      type="text"
                      value={newOrg.AD_PORT}
                      onChange={(e) =>
                        setNewOrg({ ...newOrg, AD_PORT: e.target.value })
                      }
                      className="input input-bordered w-full"
                      placeholder="contoh: 389"
                    />
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              className={`
                  w-full py-3 px-4 rounded-lg text-white font-bold text-lg
                  bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                  shadow-lg transition-all duration-300 ease-in-out flex items-center justify-center gap-2
                  ${isVerifying ? "opacity-70 cursor-not-allowed" : ""}
                `}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  {isVerifying ? "Memverifikasi..." : "Memproses..."}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Register
                </>
              )}
            </button>

            <div className="text-right">
              <a
                href="/login"
                className="text-sm text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline transition-colors duration-200"
              >
                Sudah pernah daftar?
              </a>
            </div>
          </form>

          {/* Image Section */}
          <div className="relative hidden md:flex items-center justify-center bg-blue-50 dark:bg-gray-900 p-6">
            {!isVerifying ? (
              <img
                src="/csi-logo.png" // Pastikan path ini benar
                alt="CSI Logo"
                className="max-w-[80%] max-h-[80%] object-contain" // Lebih responsif dan terpusat
              />
            ) : (
              <span className="animate-spin h-16 w-16 border-4 border-blue-500 border-t-transparent rounded-full"></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
