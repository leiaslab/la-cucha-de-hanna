"use client";

import { type PaymentMethod } from "./db";

interface PaymentMethodDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (paymentMethod: PaymentMethod) => void;
}

const PAYMENT_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  {
    value: "cash",
    label: "Efectivo",
  },
  {
    value: "mercado_pago",
    label: "Mercado Pago",
  },
  {
    value: "transfer",
    label: "Transferencia",
  },
];

export function getPaymentMethodLabel(paymentMethod: PaymentMethod) {
  if (paymentMethod === "cash") {
    return "Efectivo";
  }
  if (paymentMethod === "mercado_pago") {
    return "Mercado Pago";
  }
  return "Transferencia";
}

export function PaymentMethodDialog({
  isOpen,
  onClose,
  onSelect,
}: PaymentMethodDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-slate-100 pb-4 text-center dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Forma de pago
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            Como queres cobrar?
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Elegi una opcion para continuar con la venta.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              autoFocus={option.value === "cash"}
              className={`rounded-[1.6rem] border px-4 py-5 text-center transition-all hover:-translate-y-0.5 ${
                option.value === "cash"
                  ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                  : option.value === "mercado_pago"
                    ? "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
                    : "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              }`}
            >
              <span
                className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                  option.value === "cash"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : option.value === "mercado_pago"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {option.value === "cash" ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
                    <path d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm9 1.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z" />
                  </svg>
                ) : option.value === "mercado_pago" ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
                    <path d="M12 3c4.971 0 9 2.91 9 6.5S16.971 16 12 16 3 13.09 3 9.5 7.029 3 12 3Zm-4.46 6.446c.42.66 1.228 1.054 2.027 1.054.565 0 1.152-.204 1.55-.611l.53-.54.53.54c.398.407.985.611 1.55.611.799 0 1.607-.394 2.027-1.054l1.264.803c-.684 1.075-1.92 1.751-3.291 1.751-.752 0-1.515-.211-2.08-.665-.565.454-1.328.665-2.08.665-1.37 0-2.607-.676-3.291-1.751l1.264-.803ZM5 18.25c0-.69.56-1.25 1.25-1.25h11.5a1.25 1.25 0 1 1 0 2.5H6.25c-.69 0-1.25-.56-1.25-1.25Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
                    <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v12.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V5.75Zm3 2.25a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5H8Zm0 4a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5H8Z" />
                  </svg>
                )}
              </span>
              <span
                className={`block text-lg font-bold ${
                  option.value === "cash"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : option.value === "mercado_pago"
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {option.label}
              </span>
              <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                {option.value === "cash"
                  ? "Cobro rapido en caja"
                  : option.value === "mercado_pago"
                    ? "Pago digital inmediato"
                    : "Transferencia bancaria"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
