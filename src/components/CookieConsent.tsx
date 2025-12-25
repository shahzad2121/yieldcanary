import { useEffect } from 'react';

/**
 * CookieConsent component that injects the CookieYes script
 * for GDPR/CCPA compliant cookie consent banner.
 */
export function CookieConsent() {
  useEffect(() => {
    // Check if script already exists to prevent duplicates
    if (document.getElementById('cookieyes')) {
      return;
    }

    // Create and inject the CookieYes script
    const script = document.createElement('script');
    script.id = 'cookieyes';
    script.type = 'text/javascript';
    script.src = 'https://cdn-cookieyes.com/client_data/8dddac2ddaf627c91bd827651af7d894/script.js';
    script.async = true;

    // Add script to document head
    document.head.appendChild(script);

    // Cleanup function (optional - script will remain after component unmount)
    return () => {
      // Note: We don't remove the script on unmount as CookieYes needs it to persist
      // The script will remain in the DOM for the session
    };
  }, []);

  // Component doesn't render anything - CookieYes handles the banner UI
  return null;
}

