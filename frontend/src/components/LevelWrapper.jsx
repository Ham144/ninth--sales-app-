// src/components/LevelWrapper.jsx

import { getUserInfo } from "@/api/authApi"; // Endpoint getUserInfo yang berat
import { useUserInfo } from "@/store"; // Zustand store
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef } from "react"; // Tambahkan useRef
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LoaderOne } from "./ui/loader";

const LevelWrapper = () => {
  const { userInfo, setUserInfo } = useUserInfo();
  const location = useLocation();
  const navigate = useNavigate();
  const hasFetchedUserInfoOnMount = useRef(false); // Flag untuk melacak fetch awal

  const publicPaths = ["/login", "/about"];
  const adminOnlyPaths = [
    "/management/flow",
    "/management/users",
    "/management/sourceData/options",
    "/management/user",
  ];
  const currentPath = location.pathname;
  const isVerificationPath = currentPath === "/2fa/verification";
  const hasPending2faToken =
    typeof window !== "undefined" &&
    !!sessionStorage.getItem("pending2faToken");
  const isPublicPath =
    publicPaths.includes(currentPath) ||
    (isVerificationPath && hasPending2faToken);
  const isAdminOnlyPath = adminOnlyPaths.includes(currentPath);

  // useQuery untuk mengambil info pengguna
  const { isLoading, refetch } = useQuery({
    queryKey: ["userInfo"],
    queryFn: async () => {
      console.log("Fetching getUserInfo from backend...");
      const response = await getUserInfo();
      // Hanya set userInfo jika response success dan ada userInfo
      if (response.success && response.userInfo) {
        setUserInfo(response.userInfo);
      } else {
        // Jika tidak success, set userInfo ke null (user tidak login)
        setUserInfo(null);
      }
      return response;
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: 1,
    //getUserInfo dipanggil jika userInfo tidak ada dan BUKAN di halaman login
    // Di halaman login, TIDAK perlu cek authentication sama sekali
    enabled: !userInfo && !isPublicPath && !hasFetchedUserInfoOnMount.current,
  });

  // Efek untuk memicu fetch getUserInfo hanya saat komponen dimuat pertama kali
  // atau saat user pindah dari halaman public ke protected dan userInfo belum ada
  useEffect(() => {
    // Jika belum pernah fetch userInfo pada mount ini dan userInfo belum ada di Zustand
    // Dan bukan di halaman login
    if (!hasFetchedUserInfoOnMount.current && !userInfo && !isPublicPath) {
      console.log("Initial check or re-check for user session.");
      refetch();
      hasFetchedUserInfoOnMount.current = true; // Set flag agar tidak fetch berulang
    }
  }, [userInfo, refetch, isPublicPath]); // Dependencies

  // Efek untuk penanganan redirect berdasarkan status autentikasi dan otorisasi
  useEffect(() => {
    // 1. Jika loading selesai dan user TIDAK login dan BUKAN di public path
    // Tapi jangan redirect jika sudah di halaman login (untuk mencegah infinite loop)
    if (!isLoading && !userInfo && !isPublicPath && currentPath !== "/login") {
      console.log(
        "Redirecting to login: User not authenticated for protected path.",
      );
      navigate("/login", { replace: true });
      return;
    }

    // 2. Jika user SUDAH login dan mencoba mengakses public path (kecuali "/")
    // Ini mencegah user yang sudah login melihat halaman login/about/dokumentasi
    if (!isLoading && userInfo && isPublicPath && currentPath !== "/") {
      console.log(
        "Redirecting from public path to home: User already authenticated.",
      );
      navigate("/", { replace: true });
      return;
    }

    // 3. Otorisasi Peran: Jika user sudah login tapi rolenya tidak diizinkan untuk path ini
    if (
      !isLoading &&
      userInfo &&
      isAdminOnlyPath &&
      userInfo.role !== "owner" &&
      userInfo.role !== "supertenant"
    ) {
      console.log(
        "Redirecting due to insufficient role:",
        userInfo.role,
        currentPath,
      );
      toast.error("Anda tidak memiliki izin untuk mengakses halaman ini.");
      navigate("/not-found"); //jangan -1 potensi di akalin dari history
      return;
    }
  }, [
    userInfo,
    currentPath,
    navigate,
    isLoading,
    isPublicPath,
    isAdminOnlyPath,
  ]);
  // --- Render Logic ---

  // 1. Tampilkan loading spinner saat sedang memverifikasi autentikasi di rute non-publik
  if (isLoading && !isPublicPath) {
    return (
      <div className="flex flex-col flex-1 min-h-screen justify-center items-center">
        <LoaderOne />
      </div>
    );
  }

  // 2. Jika user tidak terautentikasi dan berada di rute terproteksi, jangan render apa-apa
  // useEffect di atas sudah akan me-redirect ke /login
  if (!userInfo && !isPublicPath) {
    return null;
  }

  // 3. Jika user terautentikasi dan berada di rute admin-only tapi rolenya tidak pengelola
  // useEffect di atas sudah akan me-redirect ke /not-found
  if (
    userInfo &&
    isAdminOnlyPath &&
    userInfo.role !== "owner" &&
    userInfo.role !== "supertenant"
  ) {
    return null; // Ini mengembalikan null, tidak me-redirect ke /
  }

  // Akhirnya, jika semua pemeriksaan berhasil, render Outlet
  return <Outlet />; // <--- Ini adalah default jika semua kondisi di atas false
};

export default LevelWrapper;
