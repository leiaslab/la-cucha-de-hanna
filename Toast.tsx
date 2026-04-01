"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const handleToast = (event: Event) => {
      const { message, type } = (
        event as CustomEvent<{ message: string; type: ToastType }>
      ).detail;
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };

    window.addEventListener("petshop-toast", handleToast);
    return () => window.removeEventListener("petshop-toast", handleToast);
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4 print:hidden">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-white font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center justify-between ${
            toast.type === "error"
              ? "bg-red-600"
              : toast.type === "success"
                ? "bg-green-600"
                : toast.type === "warning"
                  ? "bg-amber-500"
                  : "bg-blue-600"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{toast.type === "error" ? "🚫" : toast.type === "success" ? "✅" : "ℹ️"}</span>
            <p className="text-sm">{toast.message}</p>
          </div>
          <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="ml-4 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
