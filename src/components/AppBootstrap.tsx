"use client";

import { useEffect, useRef } from "react";
import { syncRemoteSnapshot } from "../lib/api-client";

async function syncSilently() {
  try {
    await syncRemoteSnapshot();
  } catch (error) {
    console.error("No se pudo sincronizar el cache local con Supabase:", error);
  }
}

async function clearLegacyOfflineArtifacts() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }
  } catch (error) {
    console.error("No se pudieron limpiar caches viejos del navegador:", error);
  }
}

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const syncIfIdle = async () => {
      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;

      try {
        await syncSilently();
      } finally {
        isSyncingRef.current = false;
      }
    };

    void clearLegacyOfflineArtifacts().finally(() => {
      void syncIfIdle();
    });

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void syncIfIdle();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncIfIdle();
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
