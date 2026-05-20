"use client";

import { useEffect, useRef, useState } from "react";
import { syncRemoteSnapshot } from "../lib/api-client";

async function clearLegacyOfflineArtifacts() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
  } catch (error) {
    console.error("No se pudieron limpiar caches viejos del navegador:", error);
  }
}

export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const isSyncingRef = useRef(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    const syncIfIdle = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await syncRemoteSnapshot();
        setSyncError(false);
      } catch (error) {
        console.error("No se pudo sincronizar el cache local con Supabase:", error);
        setSyncError(true);
      } finally {
        isSyncingRef.current = false;
      }
    };

    void clearLegacyOfflineArtifacts().finally(() => {
      void syncIfIdle();
    });

    const handleFocus = () => {
      if (document.visibilityState === "visible") void syncIfIdle();
    };

    const intervalId = window.setInterval(() => void syncIfIdle(), 60000);
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

  return (
    <>
      {syncError && (
        <div className="sticky top-0 z-50 flex items-center justify-between bg-yellow-500 px-4 py-2 text-sm font-medium text-yellow-950">
          <span>Sin conexión con el servidor — mostrando datos locales.</span>
          <button
            className="ml-4 rounded px-2 py-0.5 text-xs underline hover:no-underline"
            onClick={() => setSyncError(false)}
          >
            Cerrar
          </button>
        </div>
      )}
      {children}
    </>
  );
}
