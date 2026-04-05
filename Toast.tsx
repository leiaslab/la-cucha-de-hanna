"use client";

import { useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

export const showToast = (message: string, type: ToastType = "info") => {
  const event = new CustomEvent("petshop-toast", {
    detail: { message, type },
  });
  window.dispatchEvent(event);
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextToastIdRef = useRef(1);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const { message, type } = (
        event as CustomEvent<{ message: string; type: ToastType }>
      ).detail;

      let toastId = 0;
      let shouldScheduleDismiss = false;

      setToasts((current) => {
        const existingToast = current.find((toast) => toast.message === message && toast.type === type);
        if (existingToast) {
          toastId = existingToast.id;
          return current;
        }

        toastId = nextToastIdRef.current++;
        shouldScheduleDismiss = true;
        return [...current.slice(-2), { id: toastId, message, type }];
      });

      if (shouldScheduleDismiss) {
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== toastId));
        }, 2600);
      }
    };

    window.addEventListener("petshop-toast", handleToast);
    return () => window.removeEventListener("petshop-toast", handleToast);
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 print:hidden">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center justify-between rounded-xl px-4 py-3 font-medium text-white shadow-lg ${
            toast.type === "error"
              ? "bg-red-600"
              : toast.type === "success"
                ? "bg-green-600"
                : toast.type === "warning"
                  ? "bg-amber-500"
                  : "bg-blue-600"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-black">
              {toast.type === "error" ? "!" : toast.type === "success" ? "OK" : "i"}
            </span>
            <p className="text-sm">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            className="ml-4 text-lg leading-none opacity-70 transition hover:opacity-100"
            aria-label="Cerrar alerta"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
