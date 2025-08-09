import OrgApi from "@/api/orgApi";
import PengelolaSideBarMenu from "@/components/PengelolasSideBarMenu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Import useQueryClient
import {
  Plus,
  Search,
  FolderSearch,
  Pencil,
  Trash2,
  LogIn,
} from "lucide-react"; // Menambah ikon relevan dari Lucide React
import { useState } from "react";
import { format } from "date-fns";
import { initialOrg } from "./RegisterPage";
import { getAllAccount } from "@/api/authApi";
import { toast, Toaster } from "sonner";

export default function SuperTenantPage() {
  const queryClient = useQueryClient(); // Inisialisasi queryClient

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [newOrg, setNewOrg] = useState(initialOrg);
  const [searchUsername, setSearchUsername] = useState("");

  // --- React Query for Fetching Organizations ---
  const {
    data: orgsData,
    isPending: isLoadingOrgs,
    isError,
    error,
  } = useQuery({
    queryKey: ["orgs", searchTerm],
    queryFn: async () => await OrgApi.getAllOrgSuperTenant(searchTerm),
    staleTime: 5 * 60 * 1000, // Data dianggap segar selama 5 menit
    keepPreviousData: true, // Opsional: menjaga data sebelumnya saat searchTerm berubah untuk UX yang lebih mulus
  });

  const orgsList = orgsData?.data || []; // Amankan akses data

  // --- React Query for Disabling Organization ---
  const { mutate: disableOrgMutation, isPending: isDisabling } = useMutation({
    mutationFn: async (id) => await OrgApi.disableOrg(id),
    onSuccess: (res) => {
      toast.success(res?.message || "Organization disabled successfully!"); // Pastikan res.message atau sesuaikan
      queryClient.invalidateQueries(["orgs"]);
      closeOrgOptionModal();
    },
    onError: (err) => {
      console.error("Error disabling organization:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to disable organization. Please try again."
      );
    },
  });

  // --- React Query for Deleting Organization ---
  const { mutate: deleteOrgMutation, isPending: isDeleting } = useMutation({
    mutationFn: async (id) => await OrgApi.deleteOrg(id),
    onSuccess: (res) => {
      toast.success(res?.message || "Organization deleted successfully!"); // Pastikan res.message atau sesuaikan
      queryClient.invalidateQueries(["orgs"]);
      closeOrgOptionModal();
    },
    onError: (err) => {
      console.error("Error deleting organization:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to delete organization. Please try again."
      );
    },
  });

  const { mutate: handleCreateOrg, isPending: isLoadingOrgCreating } =
    useMutation({
      mutationKey: ["orgs"],
      mutationFn: async () => OrgApi.createOrgApi(newOrg),
      onSuccess: (res) => {
        toast.success(
          res?.response?.data?.message || "Berhasil membuat organisasi baru"
        );
        queryClient.invalidateQueries(["orgs"]);
        closeNewOrgModal();
        document.getElementById("newOrg").close();
      },
      onError: (err) => {
        toast.error(
          err?.response?.data?.message || "Terjadi kesalahn saat submit"
        );
      },
    });

  // --- Modal Handlers (using native dialog methods) ---
  const openNewOrgModal = () => {
    // setNewOrgFormData(initialOrg); // Jika Anda mengelola form di state ini
    document.getElementById("newOrg").showModal();
  };

  const closeNewOrgModal = () => {
    document.getElementById("newOrg").close();
  };

  const openOrgOptionModal = (org) => {
    setSelectedOrg(org);
    document.getElementById("orgOption").showModal();
  };

  const closeOrgOptionModal = () => {
    setSelectedOrg(null); // Bersihkan selectedOrg saat modal ditutup
    document.getElementById("orgOption").close();
  };

  // --- Event Handlers for Actions ---
  const handleDisableOrgClick = () => {
    if (selectedOrg) {
      disableOrgMutation(selectedOrg._id);
    }
  };

  const handleDeleteOrgClick = () => {
    if (selectedOrg) {
      deleteOrgMutation(selectedOrg._id);
    }
  };

  // --- Conditional Loading State ---
  if (isLoadingOrgs) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <span className="loading loading-ring loading-lg text-primary"></span>
        <p className="ml-2 text-lg text-gray-600">Loading organizations...</p>
      </div>
    );
  }

  // --- Error State for Query ---
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-200 p-4 text-center">
        <span className="text-red-500 text-5xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Failed to load organizations!
        </h2>
        <p className="text-gray-600 mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => queryClient.invalidateQueries(["orgs"])}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <PengelolaSideBarMenu>
      <div className="p-6 bg-base-100 min-h-screen">
        {/* --- Header & Search Bar --- */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Super Tenant Dashboard
          </h1>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="input input-bordered flex items-center gap-2 flex-grow">
              <input
                type="text"
                placeholder="Search organizations..."
                className="grow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="h-5 w-5 text-gray-400" />
            </label>
            <button
              onClick={openNewOrgModal}
              className="btn rounded-md btn-secondary hover:bg-primary btn-square md:btn-md tooltip tooltip-bottom text-center"
              data-tip="Add New Organization"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* --- Organizations Table --- */}
        <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
          <table className="table w-full text-sm">
            {/* Table Header */}
            <thead className="bg-gray-100 text-gray-700 uppercase">
              <tr>
                <th className="py-3 px-4 text-left">#</th>{" "}
                {/* Kolom nomor urut */}
                <th className="py-3 px-4 text-left">Nama Organisasi</th>
                <th className="py-3 px-4 text-center">Jumlah Owner</th>
                <th className="py-3 px-4 text-center">Jumlah Member</th>
                <th className="py-3 px-4 text-left">Dibuat Pada</th>
                <th className="py-3 px-4 text-left">Dibuat Oleh</th>
                <th className="py-3 px-4 text-center">Aksi</th>{" "}
                {/* Kolom untuk tombol aksi */}
              </tr>
            </thead>
            <tbody>
              {orgsList.length > 0 ? (
                orgsList.map((org, index) => (
                  <tr
                    key={org._id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3 px-4 font-medium">{index + 1}</td>
                    <td className="py-3 px-4 font-semibold text-primary">
                      {org.organizationName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {org.owners?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {org.members?.length || 0}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {org.createdAt
                        ? format(new Date(org.createdAt), "dd MMM yyyy, HH:mm")
                        : "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {org.createdBy?.username || "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah modal lain terbuka
                          openOrgOptionModal(org);
                        }}
                        className="btn btn-ghost btn-sm tooltip tooltip-top"
                        data-tip="Manage Organization"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    <FolderSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg">No organizations found.</p>
                    <p className="text-sm">
                      Try adjusting your search or add a new one.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modal Opsi Organisasi (Manage/Disable/Delete) --- */}
      <dialog id="orgOption" className="modal modal-middle sm:modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-xl mb-4">
            Manage Organization:{" "}
            <span className="text-primary">
              {selectedOrg?.organizationName}
            </span>
          </h3>
          <div className="flex flex-col gap-3">
            <button className="btn btn-info btn-outline text-left justify-start">
              <LogIn className="h-5 w-5 mr-2" />
              Login to this organization (Coming Soon)
            </button>
            <button
              onClick={handleDisableOrgClick}
              className="btn btn-warning btn-outline text-left justify-start"
              disabled={isDisabling} // Disable button saat loading
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {isDisabling ? "Disabling..." : "Disable Organization"}
            </button>
            <button
              onClick={handleDeleteOrgClick}
              className="btn btn-error btn-outline text-left justify-start"
              disabled={isDeleting} // Disable button saat loading
            >
              <Trash2 className="h-5 w-5 mr-2" />
              {isDeleting ? "Deleting..." : "Delete Organization"}
            </button>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn" onClick={closeOrgOptionModal}>
                Close
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* --- Modal untuk Membuat Organisasi Baru --- */}
      <dialog id="newOrg" className="modal modal-middle sm:modal-middle">
        <div className="modal-box">
          <form method="dialog">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeNewOrgModal} // Tambahkan handler untuk menutup modal
            >
              ✕
            </button>
          </form>
          <h3 className="font-bold text-xl mb-4">Create New Organization</h3>
          <div className="py-4">
            <Toaster />
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
            <div className="modal-action">
              <button
                className={`btn ${isLoadingOrgCreating && "loading"}`}
                onClick={handleCreateOrg}
              >
                Create
              </button>
              <button
                className={`btn ${isLoadingOrgCreating && "loading"}`}
                onClick={closeNewOrgModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </PengelolaSideBarMenu>
  );
}
