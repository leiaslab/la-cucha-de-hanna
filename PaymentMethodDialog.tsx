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
        className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-slate-100 pb-4 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              Forma de pago
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              autoFocus={option.value === "cash"}
              className={`rounded-[1.4rem] border px-4 py-4 text-center transition-all hover:-translate-y-0.5 ${
                option.value === "cash"
                  ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100"
                  : option.value === "mercado_pago"
                    ? "border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100"
                    : "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100"
              }`}
            >
              <span
                className={`block text-lg font-bold ${
                  option.value === "cash"
                    ? "text-emerald-700"
                    : option.value === "mercado_pago"
                      ? "text-blue-700"
                      : "text-amber-700"
                }`}
              >
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
