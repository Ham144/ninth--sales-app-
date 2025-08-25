import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query"; // Asumsi Anda pakai TanStack Query
import {
  User,
  Settings,
  LogOut,
  KeyRound,
  Info,
  Group,
  QrCode,
} from "lucide-react"; // Impor ikon Lucide React yang lebih relevan
import { useUserInfo } from "@/store";
import { deactivate2Fa, getStatus2Fa, logout } from "@/api/authApi";
import OrgApi from "@/api/orgApi";
import { toast } from "sonner";
import Modal2FA from "@/components/Modal2FA";

const ManagementButton = () => {
  const managementMenus = [
    {
      title: "Source Data Options",
      description:
        "mangement untuk tiap source data select/options ytang telah dibuat",
      url: "/management/sourceData/options",
    },
    {
      title: "User Management",
      description: "Melihat list dari user aplikasi ini",
      url: "/management/user",
    },
    {
      title: "Management Flow Template",
      description:
        "Management untuk melihat/ mengedit flow design yang telah dibuat",
      url: "/management/flow",
    },
  ];
  const navigate = useNavigate();

  return (
    <div className="flex gap-y-2 flex-col justify-center">
      {managementMenus.map((menu) => (
        <div className="card bg-transparent border rounded-lg">
          <div className="card-body">
            <h2 className="card-title">{menu.title}</h2>
            <p>{menu.description}</p>
            <div className="card-actions justify-end">
              <button
                onClick={() => navigate(menu.url)}
                className="btn btn-primary text-white rounded-md"
              >
                Kunjungi
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const { userInfo, clearUserInfo } = useUserInfo();
  const queryClient = useQueryClient();
  const { data: myOrg } = useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const res = await OrgApi.getMyOrg(userInfo?.org);
      return res?.data;
    },
    enabled: !!userInfo?.org,
  });

  //to check /2fa/status
  const { data: _2faIsVerified } = useQuery({
    queryKey: ["2faStatus"],
    queryFn: async () => await getStatus2Fa(),
    enabled: !!userInfo,
  });

  const { mutateAsync: handleDeactivate2fa } = useMutation({
    mutationKey: ["2faStatus", "2faDeactivate"],
    mutationFn: async () => await deactivate2Fa(),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["2faStatus"]);
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "2fa deactivation failed");
    },
  });

  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    password: "",
    role: userInfo?.role || "", // Default role based on userInfo
  });

  const { mutate: handleLogout } = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearUserInfo();
      queryClient.clear();
      navigate("/login");
      toast.success("Berhasil logout.");
    },
    onError: (error) => {
      const errorMessage = error?.response?.data?.message || "Gagal logout.";
      toast.error(errorMessage);
    },
  });

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-5 h-5" /> },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header with Tab Navigation */}
      <div className="sticky  top-0 z-20  dark:bg-gray-800 shadow-md py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2 ">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base font-medium
                transition-all duration-200 ease-in-out flex-1 sm:flex-initial
                ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }
              `}
              title={tab.label}
              aria-label={`Switch to ${tab.label} tab`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.icon}
              <span className="sm:inline">{tab.label}</span>
            </button>
          ))}
          {/* Logout Button */}
          <button
            onClick={() => {
              if (window.confirm("Apakah Anda yakin ingin logout?")) {
                handleLogout();
              }
            }}
            className="
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base font-medium
              bg-red-500 hover:bg-red-600 text-white shadow-lg
              transition-colors duration-200 ease-in-out flex-1 sm:flex-initial
            "
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 mx-auto sm:p-6 lg:p-8 max-w-6xl w">
        <div className="">
          {activeTab === "profile" && (
            <div className="space-y-8">
              <h2 className="text-2xl sm:text-3xl text-center text-gray-800 dark:text-gray-200  pb-4 font-light  mb-4">
                Informasi Profile
              </h2>

              <div className="grid  grid-cols-1 md:grid-cols-2 gap-6">
                {/* Username Card */}
                <div className=" rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-6 h-6 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Username
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
                    {userInfo?.username || "N/A"}
                  </p>
                </div>
                <div className=" rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <Group className="w-6 h-6 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Organisasi
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
                    {myOrg?.organizationName || "N/A"}
                  </p>
                </div>

                {/* Role Card */}
                <div className=" dark:bg-gray-700 rounded-lg p-5 shadow-sm border  dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <KeyRound className="w-6 h-6 text-purple-500" />
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      AD Description
                    </h4>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                    {userInfo?.description || "N/A"}
                  </p>
                </div>
                {/* Authenticator CARD */}
                <div className=" dark:bg-gray-700 rounded-lg p-5 shadow-sm border  dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <QrCode className="w-6 h-6 text-indigo-500" />
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {_2faIsVerified?.success
                        ? "2FA Activated"
                        : "2FA is not activated yet"}
                    </h4>
                  </div>

                  <button
                    onClick={() => {
                      if (_2faIsVerified?.success) {
                        const confirm = window.confirm(
                          "Are you sure to deactivate the 2fa authenticator"
                        );
                        if (confirm) {
                          handleDeactivate2fa();
                        }
                      } else {
                        document.getElementById("modal-2fa")?.showModal();
                      }
                    }}
                    className={`btn  text-xl font-bold text-gray-900 dark:text-gray-100 capitalize rounded-lg ${
                      _2faIsVerified?.success ? "bg-red-300" : "bg-green-300"
                    }`}
                  >
                    {_2faIsVerified?.success ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === "settings" && (
            <div className="space-y-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-200 border-b pb-4 mb-4">
                Pengaturan Lainnya
              </h2>
              {userInfo?.role !== "owner" ? (
                <ManagementButton />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700  mx-auto flex justify-center flex-col  ">
                  <div className="flex items-center gap-3 mb-2">
                    <Info className="w-6 h-6 text-gray-500" />
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Pengaturan
                    </h4>
                  </div>
                  <p className="text-base text-gray-900 dark:text-gray-100">
                    Belum ada fitur pengaturan khusus tersedia untuk peran Anda.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal2FA
        key={"modal-2fa"}
        onSuccess={() => {
          document.getElementById("modal-2fa")?.close();
        }}
        _2faIsVerified={_2faIsVerified}
      />
    </div>
  );
};

export default Profile;
