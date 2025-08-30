import { siteKeyCloudflare } from "@/api/constant";
import { useEffect, useRef, useState } from "react";

const TurnstileCaptcha = ({ siteKey, onVerify }) => {
  const captchaRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    window.onTurnstileSuccess = function (token) {
      console.log("✅ Turnstile token:", token);

      if (window.CaptchaChannel) {
        window.CaptchaChannel.postMessage(token);
      } else {
        console.log("⚠️ CaptchaChannel not available in Flutter");
      }
    };

    // Load hanya sekali
    if (!document.getElementById("cf-turnstile-flutter")) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.id = "cf-turnstile-flutter";
      script.onload = () => setScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }

    return () => {
      // Clean up script and global callback
      document.body.removeChild(script);
      delete window.onTurnstileSuccess;
    };
  }, []);

  useEffect(() => {
    if (
      scriptLoaded &&
      window.turnstile &&
      captchaRef.current &&
      captchaRef.current.childNodes.length === 0
    ) {
      window.turnstile.render(captchaRef.current, {
        "data-callback": "onTurnstileSuccess",
        sitekey: siteKeyCloudflare,
        theme: "light",
        size: "normal",
        callback: (token) => {
          onVerify(token); // kirim token ke parent
        },
      });
    }
  }, [scriptLoaded, siteKey, onVerify]);

  return <div ref={captchaRef} />;
};

export default TurnstileCaptcha;
