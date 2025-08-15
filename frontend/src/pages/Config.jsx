import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PengelolaSideBarMenu from "@/components/PengelolasSideBarMenu";
import configApi from "@/api/configApi";
import { toast } from "sonner";
import { Building, SaveAll, Settings2 } from "lucide-react";

export default function Config() {
  const [recipientTEMP, setrecipientTEMP] = useState("");
  const [openIndex, setOpenIndex] = useState(null);
  const [form, setForm] = useState({
    SOAP_PRODUCT_URL: "",
    SOAP_PRODUCT_USERNAME: "",
    SOAP_PRODUCT_PASSWORD: "",
    SOAP_PRODUCT_SOAPACTION: "",
    SOAP_STOCK_URL: "",
    SOAP_STOCK_USERNAME: "",
    SOAP_STOCK_PASSWORD: "",
    SOAP_STOCK_SOAPACTION: "",
    SOAP_CUSTOMER_URL: "",
    SOAP_CUSTOMER_USERNAME: "",
    SOAP_CUSTOMER_PASSWORD: "",
    SOAP_CUSTOMER_SOAPACTION: "",
    SOAP_TRANSACTION_URL: "",
    SOAP_TRANSACTION_USERNAME: "",
    SOAP_TRANSACTION_PASSWORD: "",
    SOAP_TRANSACTION_SOAPACTION: "",
    SOAP_PEMBAYARANTERTUNDA_URL: "",
    SOAP_PEMBAYARANTERTUNDA_USERNAME: "",
    SOAP_PEMBAYARANTERTUNDA_PASSWORD: "",
    SOAP_PEMBAYARANTERTUNDA_SOAPACTION: "",
  });

  const services = [
    "Product Service",
    "Stock Service",
    "Customer Service",
    "Transaction Service",
    "Pembayaran Tertunda Service",
  ];

  const { mutateAsync: handleTestEmail, isPending: loadingSendingEmail } =
    useMutation({
      mutationKey: ["test"],
      mutationFn: async () =>
        await configApi.testSMTP({
          EMAIL_HOST: form.EMAIL_HOST,
          EMAIL_PORT: form.EMAIL_PORT,
          EMAIL_SECURE: form.EMAIL_SECURE,
          EMAIL_USER: form.EMAIL_USER,
          EMAIL_PASS: form.EMAIL_PASS,
          recipient: recipientTEMP,
        }),
      onSuccess: () => {
        toast.success("TEST BERHASIL, Email berhasil dikirim");
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || "Gagal mengirim email");
      },
    });

  const {
    data: configData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["config"],
    queryFn: async () => await configApi.getAllConfig(),
    // Tambahkan refetchOnWindowFocus: false jika Anda tidak ingin refetch otomatis
    refetchOnWindowFocus: false,
  });

  const { mutate: handleUpdate, isLoading: isUpdating } = useMutation({
    mutationKey: ["config", "update"],
    mutationFn: async () =>
      await configApi.updateAllConfig({
        ...form,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["config"]);
      toast.success("Config berhasil diperbarui");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Gagal memperbarui config");
    },
  });

  const queryClient = useQueryClient();

  // helper mapping
  const prefixes = [
    "SOAP_PRODUCT_",
    "SOAP_STOCK_",
    "SOAP_CUSTOMER_",
    "SOAP_TRANSACTION_",
    "SOAP_PEMBAYARANTERTUNDA_",
  ];

  console.log(form);

  const suffixMap = {
    URL: "URL",
    Username: "USERNAME",
    Password: "PASSWORD",
    SOAPAction: "SOAPACTION",
  };

  function buildKey(name, index) {
    if (index == null) return null; // kalau collapse ditutup
    const pref = prefixes[index];
    const suf = suffixMap[name];
    if (!pref || !suf) return null;
    return pref + suf;
  }

  // generic onChange
  function onChangeSoapService(e) {
    const key = buildKey(e.target.name, openIndex);
    if (!key) return;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // getter untuk value (dipakai di JSX)
  function getSoapValue(name) {
    const key = buildKey(name, openIndex);
    return key ? form[key] ?? "" : "";
  }

  const fields = [
    { label: "SOAP URL", type: "text", name: "URL" },
    { label: "Username", type: "text", name: "Username" },
    { label: "Password", type: "password", name: "Password" },
    { label: "SOAP Action", type: "text", name: "SOAPAction" },
  ];

  useEffect(() => {
    if (configData) {
      setForm(configData?.data);
    }
  }, [configData]);

  if (isLoading) {
    return (
      <PengelolaSideBarMenu>
        <div className="flex justify-center items-center h-40">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </PengelolaSideBarMenu>
    );
  }

  if (error) {
    return (
      <PengelolaSideBarMenu>
        <div className="alert alert-error">
          <span>Error: {error?.message || "Gagal memuat config"}</span>
        </div>
      </PengelolaSideBarMenu>
    );
  }

  return (
    <PengelolaSideBarMenu>
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />

      <div className="relative z-10 p-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
            <h1 className="text-2xl font-bold">
              Konfigurasi terkait organisasi
            </h1>
            <p className="opacity-90">
              Pengaturan ini hanya berlaku di organisasi anda bukan di seluruh
              tenant
            </p>
            <p className="text-gray-200 text-xs mt-6">
              Jika tidak ingin mengubah field, kosongkan saja, field kosong
              tidak akan berdampak apapun
            </p>
          </div>

          {/* Form Sections */}
          <div className="p-6 space-y-8">
            {/* Active Directory Section */}
            <div className="card bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100">
              <div className="card-body">
                <h2 className="card-title text-purple-700">
                  <Building className="w-6 h-6" />
                  Active Directory Configuration
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-purple-700">
                        AD Host
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ad.example.com"
                      className="input input-bordered"
                      value={form["AD_HOST"]}
                      onChange={(e) =>
                        setForm({ ...form, AD_HOST: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-purple-700">
                        AD Port
                      </span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 389"
                      className="input input-bordered"
                      value={form["AD_PORT"]}
                      onChange={(e) =>
                        setForm({ ...form, AD_PORT: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-purple-700">
                        AD Domain
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. example.com"
                      className="input input-bordered"
                      value={form["AD_DOMAIN"]}
                      onChange={(e) =>
                        setForm({ ...form, AD_DOMAIN: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-purple-700">
                        AD Base DN
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DC=csi,DC=my,DC=id"
                      className="input input-bordered"
                      value={form["AD_BASE_DN"]}
                      onChange={(e) =>
                        setForm({ ...form, AD_BASE_DN: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SMTP Section */}
            <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
              <div className="card-body">
                <h2 className="card-title text-blue-700">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  SMTP Configuration
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Email Host
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. smtp.example.com"
                      className="input input-bordered"
                      value={form["EMAIL_HOST"]}
                      onChange={(e) =>
                        setForm({ ...form, EMAIL_HOST: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Email Port
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 587"
                      className="input input-bordered"
                      value={form["EMAIL_PORT"]}
                      onChange={(e) =>
                        setForm({ ...form, EMAIL_PORT: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Email Username
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. user@example.com"
                      className="input input-bordered"
                      value={form["EMAIL_USER"]}
                      onChange={(e) =>
                        setForm({ ...form, EMAIL_USER: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Email Password
                      </span>
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input input-bordered"
                      value={form["EMAIL_PASS"]}
                      onChange={(e) =>
                        setForm({ ...form, EMAIL_PASS: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Secure Connection
                      </span>
                    </label>
                    <select
                      value={form["EMAIL_SECURE"]}
                      onChange={(e) =>
                        setForm({ ...form, EMAIL_SECURE: e.target.value })
                      }
                      className="select select-bordered"
                    >
                      <option value="false">No (STARTTLS)</option>
                      <option value="true">Yes (SSL/TLS)</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-blue-700">
                        Test Recipient
                      </span>
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="yafizham@catur.co.id"
                        className="input input-bordered flex-1"
                        value={recipientTEMP}
                        onChange={(e) => setrecipientTEMP(e.target.value)}
                      />
                      <button
                        onClick={handleTestEmail}
                        className="btn bg-orange-500 rounded-lg text-white"
                      >
                        {loadingSendingEmail ? (
                          <span className="loading loading-ring loading-lg"></span>
                        ) : (
                          "TEST"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Soap  */}
            <div className="card bg-gradient-to-br from-green-50 to-teal-50 border border-green-100">
              <div className="card-body">
                <h2 className="card-title text-green-700">
                  <Settings2 />
                  SOAP Services Configuration
                </h2>

                {services.map((title, i) => (
                  <div
                    key={i}
                    className={`collapse collapse-plus border border-green-200 rounded-box mt-4 ${
                      openIndex === i ? "collapse-open" : ""
                    }`}
                  >
                    <div
                      className="collapse-title text-lg font-medium text-green-700 cursor-pointer"
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    >
                      {title}
                    </div>
                    <div className="collapse-content">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fields.map((f, idx) => (
                          <div key={idx} className="form-control">
                            <label className="label">
                              <span className="label-text">{f.label}</span>
                            </label>
                            <input
                              type={f.type}
                              name={f.name}
                              className="input input-bordered"
                              placeholder={f.name}
                              onChange={onChangeSoapService}
                              value={getSoapValue(f.name)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isLoading || isUpdating}
                className="btn btn-primary bg-orange-500 rounded-lg border-0 text-white"
              >
                {isLoading ||
                  (isUpdating && (
                    <span className="loading loading-ring loading-lg"></span>
                  ))}{" "}
                Save Configuration
                <SaveAll />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PengelolaSideBarMenu>
  );
}
