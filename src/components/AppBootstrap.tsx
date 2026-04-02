"use client";

import { useEffect } from "react";
import { syncRemoteSnapshot } from "../lib/api-client";

async function syncSilently() {
  try {
    await syncRemoteSnapshot();
  } catch (error) {
    console.error("No se pudo sincronizar el cache local con Supabase:", error);
  }
}

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void syncSilently();

    const handleFocus = () => {
      void syncSilently();
    };

    const intervalId = window.setInterval(() => {
      void syncSilently();
    }, 60000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("online", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("online", handleFocus);
    };
  }, []);

  return <>{children}</>;
}
