import { activate2Fa, verify2Fa } from "@/api/authApi";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

const Modal2FA = ({ onSuccess, _2faIsVerified }) => {
  //2fa authenticator temp states
  const [otp, setOtp] = useState("");

  //get QR to scan
  const {
    data: qrCode,
    isPending: isPendingQr,
    error: errorQr,
  } = useQuery({
    queryKey: ["2faGeneration"],
    queryFn: async () => await activate2Fa(),
    taleTime: Infinity, // Data is always considered fresh
    cacheTime: Infinity, // Prevent garbage collection of the query
    refetchOnMount: false, // Do not refetch when the component mounts
    refetchOnWindowFocus: false, // Do not refetch when the window regains focus
    refetchOnReconnect: false, // Do not refetch on network reconnect
    enabled: !!_2faIsVerified?.success ? false : true,
  });

  //send otp to confirm activation
  const { mutateAsync: handleConfirmOtp } = useMutation({
    mutationKey: ["2faConfirm", "2faStatus"],
    mutationFn: async () => verify2Fa({ otp }),
    onSuccess: () => {
      onSuccess();
      setOtp("");
      toast.success("2fa activated successfully");
      window.location.reload();
    },
    onError: (err) => {
      setOtp("");
      toast.error(
        err?.response?.data?.message || "2fa activation confirm failed"
      );
    },
  });

  useEffect(() => {
    setOtp("");
  }, []);

  //listener for auto enter when the otp is 6 length
  useEffect(() => {
    if (otp?.length > 5) {
      handleConfirmOtp();
    }
  }, [otp]);

  return (
    <dialog id="modal-2fa" className="modal">
      <Toaster position="top-center" />
      <div className="modal-box bg-white rounded-lg p-6">
        <h3 className="text-2xl font-bold text-primary mb-4">
          Activate 2fa Authenticator for this account
        </h3>
        {qrCode?.data?.qrCode ? (
          <div className="flex flex-col w-full justify-center items-center mt-4">
            <img
              src={qrCode.data.qrCode}
              alt="qrCode"
              className="w-64 h-auto"
            />
            <div className="ml-4 w-full">
              <input
                type="text"
                onChange={(e) => setOtp(e.target.value)}
                value={otp}
                placeholder="Input  the 6 otp on your authenticator app"
                className="input font-bold  rounded-lg input-bordered input-accent w-full"
              />
            </div>
          </div>
        ) : (
          <div role="alert" className="alert alert-error my-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {errorQr
                ? JSON.stringify(errorQr)
                : "Error! Qr code generation failed ."}
            </span>
          </div>
        )}

        <div className="modal-action mt-6 flex justify-center">
          <div role="alert" className="alert alert-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              How to: Download Google Authenticator on PS/APPstore and scan the
              code and input its number!
            </span>
            <form method="dialog" className="w-full">
              <button className="btn w-full">Close</button>
            </form>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default Modal2FA;
