import { siteKeyCloudflare } from "@/api/constant";
import { useEffect, useRef, useState } from "react";

const TurnstileCaptcha = ({ siteKey, onVerify, onError }) => {
  const captchaRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const scriptRef = useRef(null);

  useEffect(() => {
    window.onTurnstileSuccess = function (token) {
      if (window.CaptchaChannel) {
        window.CaptchaChannel.postMessage(token);
      }
    };

    // Load hanya sekali
    if (!document.getElementById("cf-turnstile-script")) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.id = "cf-turnstile-script";
      script.onload = () => setScriptLoaded(true);
      script.onerror = () => {
        if (onError) onError("Gagal memuat script captcha");
      };
      scriptRef.current = script;
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }

    return () => {
      // Clean up script and global callback
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
      }
      delete window.onTurnstileSuccess;
    };
  }, [onError]);
  
  useEffect(() => {
    if (
      scriptLoaded &&
      window.turnstile &&
      captchaRef.current &&
      captchaRef.current.childNodes.length === 0
    ) {
      try {
        window.turnstile.render(captchaRef.current, {
          "data-callback": "onTurnstileSuccess",
          sitekey: siteKey || siteKeyCloudflare,
          theme: "light",
          size: "normal",
          callback: (token) => {
            onVerify(token); // kirim token ke parent
          },
          "expired-callback": () => {
            if (onError) onError("Captcha expired, silakan coba lagi");
          },
          "error-callback": () => {
            if (onError) onError("Terjadi kesalahan pada captcha");
          },
        });
      } catch (error) {
        if (onError) onError("Gagal merender captcha");
      }
    }
  }, [scriptLoaded, siteKey, onVerify, onError]);

  return <div ref={captchaRef} />;
};

export default TurnstileCaptcha;
