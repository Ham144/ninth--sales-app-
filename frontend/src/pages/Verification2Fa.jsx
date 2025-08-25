import { complete2faLogin, verify2Fa } from "@/api/authApi";
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const Verification2Fa = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const pendingToken =
    typeof window !== "undefined"
      ? sessionStorage.getItem("pending2faToken")
      : null;

  const { mutateAsync: handleConfirmOtp } = useMutation({
    mutationKey: ["2faConfirm", "2faStatus"],
    mutationFn: async () => {
      if (pendingToken) {
        return await complete2faLogin({ otp, pendingToken });
      }
      return await verify2Fa({ otp });
    },
    onSuccess: () => {
      setOtp("");
      if (pendingToken) {
        sessionStorage.removeItem("pending2faToken");
        toast.success("Login berhasil dengan 2FA");
        navigate("/");
        setTimeout(() => navigate("/"), 500);
      } else {
        toast.success("2FA activated successfully");
        window.location.reload();
      }
    },
    onError: (err) => {
      setOtp("");
      toast.error(
        err?.response?.data?.message || "2fa activation confirm failed"
      );
    },
  });

  return (
    <div className="flex items-center justify-center mx-auto container min-h-screen flex-col gap-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Verifikasi 2FA</h1>
        <p className="text-sm text-gray-500">
          Masukkan 6 digit OTP dari aplikasi authenticator Google Authenticator
        </p>
      </div>
      <input
        type="text"
        placeholder="Masukkan 6 digit OTP dari google authenticator (Sales Order APP)"
        className="input max-w-md input-bordered w-full"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleConfirmOtp();
          }
        }}
      />
      <button
        className="max-w-md rounded-lg shadow-md w-full btn bg-orange-500 text-white"
        onClick={() => handleConfirmOtp()}
      >
        Konfirmasi
      </button>
    </div>
  );
};

export default Verification2Fa;
