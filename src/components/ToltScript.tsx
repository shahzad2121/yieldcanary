import { useEffect } from "react";

/**
 * Injects the Tolt affiliate tracking script so referral links set window.tolt_referral.
 * Add VITE_TOLT_PUBLIC_ID to .env to enable. Script loads on every page to capture referrals.
 */
export function ToltScript() {
  useEffect(() => {
    const publicId = import.meta.env.VITE_TOLT_PUBLIC_ID;
    if (!publicId || typeof publicId !== "string") return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://files.tlt-cdn.com/tlt.js";
    script.setAttribute("data-tolt", publicId);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
