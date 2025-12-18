import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// 2 minutes for testing; change to 30 * 60 * 1000 in production
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // check every 10 seconds

export function useAutoLogout() {
  const navigate = useNavigate();
  const lastActivityRef = useRef<number>(Date.now());
  const trackingRef = useRef(false);

  useEffect(() => {
    let intervalId: number | null = null;
    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const startTracking = () => {
      if (trackingRef.current) return;
      trackingRef.current = true;
      lastActivityRef.current = Date.now();

      activityEvents.forEach((eventName) => {
        window.addEventListener(eventName, markActivity, { passive: true });
      });

      intervalId = window.setInterval(async () => {
        const now = Date.now();
        const inactiveMs = now - lastActivityRef.current;

        if (inactiveMs < INACTIVITY_LIMIT_MS) {
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) {
            return;
          }

          console.log(
            `[AutoLogout] Inactive for ${Math.round(
              inactiveMs / 60000
            )} minutes, signing out user ${session.user.email}`
          );

          await supabase.auth.signOut();
          navigate("/auth");
        } catch (error) {
          console.error("[AutoLogout] Error during auto sign-out:", error);
        } finally {
          // After auto-logout, stop tracking to avoid repeated work
          stopTracking();
        }
      }, CHECK_INTERVAL_MS);
    };

    const stopTracking = () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Initial check: if there's already a session, start tracking
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        startTracking();
      }
    }).catch((error) => {
      console.error("[AutoLogout] Error checking initial session:", error);
    });

    // Keep tracking in sync with auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          startTracking();
        }
        if (event === "SIGNED_OUT") {
          stopTracking();
        }
      }
    );

    return () => {
      stopTracking();
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);
}


