import TurnstileCaptcha from "@/components/TurnstileCaptcha";
import React, { useState } from "react";

const CapthaGeneration = () => {
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  const handleVerify = (token) => {
    if (!token) {
      window.location.reload();
      return;
    }
    setCaptchaToken(token);
  };

  const handleError = (errorMessage) => {
    setCaptchaError(errorMessage);
    setCaptchaToken("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Captcha Generation
        </h1>

        <div className="space-y-4">
          <div className="flex justify-center">
            <TurnstileCaptcha
              onVerify={handleVerify}
              onError={handleError}
              siteKey={"0x4AAAAAABm1f4qluraiCXZR"}
            />
          </div>

          {captchaError && (
            <div className="text-red-500 text-sm text-center p-3 bg-red-50 rounded-lg">
              {captchaError}
            </div>
          )}

          <div className="text-xs text-gray-500 text-center">
            Halaman ini untuk testing dan development captcha
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapthaGeneration;
