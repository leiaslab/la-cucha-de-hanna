"use client";

import { useState } from "react";
import { type CartItem, type PaymentMethod, type ReservationPlan } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { createReservationPlanRemote } from "./src/lib/api-client";
import { showToast } from "./Toast";

interface ElectronicsCheckoutDialogProps {
  isOpen: boolean;
  cartItems: CartItem[];
  total: number;
  clientId: number | null;
  notes?: string;
  onCash: () => void;
  onReserved: (plan: ReservationPlan) => void;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "mercado_pago", "transfer"];

export function ElectronicsCheckoutDialog({
  isOpen,
  cartItems,
  total,
  clientId,
  notes,
  onCash,
  onReserved,
  onClose,
}: ElectronicsCheckoutDialogProps) {
  const [mode, setMode] = useState<"choice" | "reservation">("choice");
  const [initialPayment, setInitialPayment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  const resetDialog = () => {
    setMode("choice");
    setInitialPayment("");
    setPaymentMethod("cash");
  };

  const closeDialog = () => {
    resetDialog();
    onClose();
  };

  const handleCreateReservation = async () => {
    if (!clientId) {
      showToast("Selecciona un cliente antes de crear la reserva.", "error");
      return;
    }

    const amount = Number(initialPayment);
    if (!Number.isFinite(amount) || amount < 0 || amount > total) {
      showToast("La entrega inicial debe estar entre $0 y el total.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createReservationPlanRemote({
        cartItems,
        clientId,
        initialPayment: amount,
        paymentMethod,
        notes,
      });
      resetDialog();
      onReserved(result.plan);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "No se pudo crear el plan de reserva.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSaving) closeDialog();
      }}
    >
      <div
        className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
              Electronica
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
              {mode === "choice" ? "¿Cómo se entrega?" : "Nuevo plan de reserva"}
            </h2>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={closeDialog}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
          >
            Cerrar
          </button>
        </div>

        {mode === "choice" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                resetDialog();
                onCash();
              }}
              className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-left transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <span className="block text-xl font-black text-emerald-800 dark:text-emerald-200">
                Al contado
              </span>
              <span className="mt-2 block text-sm text-emerald-700 dark:text-emerald-300">
                Se cobra y se entrega ahora.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("reservation")}
              className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30"
            >
              <span className="block text-xl font-black text-blue-800 dark:text-blue-200">
                Plan reserva
              </span>
              <span className="mt-2 block text-sm text-blue-700 dark:text-blue-300">
                El cliente paga de a poco y se entrega al completar.
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-300">Cliente</span>
                <span className="text-right font-bold text-slate-900 dark:text-slate-100">
                  {clientId ? "Cliente seleccionado" : "Sin seleccionar"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-300">Total reservado</span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ${Math.round(total).toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            {!clientId && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                Cierra esta ventana y selecciona el cliente en el carrito.
              </p>
            )}

            <div>
              <label htmlFor="reservation-initial-payment" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Entrega inicial
              </label>
              <input
                id="reservation-initial-payment"
                type="number"
                min="0"
                max={total}
                step="0.01"
                value={initialPayment}
                onChange={(event) => setInitialPayment(event.target.value)}
                placeholder="Ej: 20000"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-lg font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Forma de pago</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                      paymentMethod === method
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    }`}
                  >
                    {getPaymentMethodLabel(method)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setMode("choice")}
                className="rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isSaving || !clientId}
                onClick={() => void handleCreateReservation()}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving ? "Guardando reserva..." : "Crear plan de reserva"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
