"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError, syncRemoteSnapshot } from "../lib/api-client";

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
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const syncIfIdle = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await syncRemoteSnapshot();
        setSyncError(null);
      } catch (error) {
        console.error("No se pudo sincronizar el cache local con Supabase:", error);

        if (error instanceof ApiRequestError && error.status === 401) {
          window.location.reload();
          return;
        }

        setSyncError(
          error instanceof ApiRequestError
            ? "El servidor no pudo sincronizar los datos. Se volvera a intentar automaticamente."
            : "Sin conexion con el servidor — mostrando datos locales.",
        );
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
          <span>{syncError}</span>
          <button
            className="ml-4 rounded px-2 py-0.5 text-xs underline hover:no-underline"
            onClick={() => setSyncError(null)}
          >
            Cerrar
          </button>
        </div>
      )}
      {children}
    </>
  );
}
