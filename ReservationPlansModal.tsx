"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaymentMethod, ReservationPlan } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import {
  addReservationPaymentRemote,
  deliverReservationPlanRemote,
  listReservationPlansRemote,
} from "./src/lib/api-client";
import { showToast } from "./Toast";

interface ReservationPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "mercado_pago", "transfer"];

function statusLabel(status: ReservationPlan["status"]) {
  if (status === "active") return "En pago";
  if (status === "paid") return "Listo para entregar";
  if (status === "delivered") return "Entregado";
  return "Cancelado";
}

export function ReservationPlansModal({ isOpen, onClose }: ReservationPlansModalProps) {
  const [plans, setPlans] = useState<ReservationPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [payingPlanId, setPayingPlanId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    void listReservationPlansRemote()
      .then((data) => {
        if (!cancelled) setPlans(data);
      })
      .catch((error) => {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : "No se pudieron cargar las reservas.", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filteredPlans = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    if (!normalized) return plans;
    return plans.filter((plan) =>
      [plan.clientName, plan.clientPhone, String(plan.id), ...plan.items.map((item) => item.name)]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(normalized)),
    );
  }, [plans, search]);

  if (!isOpen) return null;

  const replacePlan = (updatedPlan: ReservationPlan) => {
    setPlans((current) => current.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan)));
  };

  const handleAddPayment = async (plan: ReservationPlan) => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > plan.balance) {
      showToast(`El pago debe ser mayor a $0 y no superar $${Math.round(plan.balance).toLocaleString("es-AR")}.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      const result = await addReservationPaymentRemote(plan.id, {
        amount,
        paymentMethod,
      });
      replacePlan(result.plan);
      setPayingPlanId(null);
      setPaymentAmount("");
      showToast(
        result.plan.status === "paid"
          ? "Pago registrado. El producto ya esta listo para entregar."
          : "Pago registrado correctamente.",
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo registrar el pago.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeliver = async (plan: ReservationPlan) => {
    if (!confirm(`¿Confirmas la entrega de la reserva #${plan.id} a ${plan.clientName}?`)) return;

    setIsSaving(true);
    try {
      const updated = await deliverReservationPlanRemote(plan.id);
      replacePlan(updated);
      showToast("Producto entregado y reserva completada.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo registrar la entrega.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">Electronica</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">Planes de reserva</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registra pagos y entrega el producto cuando el saldo llegue a cero.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
          >
            Cerrar
          </button>
        </header>

        <div className="border-b border-slate-100 p-4 dark:border-slate-800 sm:px-6">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, producto o numero de reserva"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <p className="py-10 text-center font-semibold text-slate-500">Cargando reservas...</p>
          ) : filteredPlans.length === 0 ? (
            <p className="py-10 text-center font-semibold text-slate-500">No hay planes de reserva.</p>
          ) : (
            filteredPlans.map((plan) => {
              const progress = plan.totalAmount > 0 ? Math.min(100, (plan.paidAmount / plan.totalAmount) * 100) : 0;
              return (
                <article key={plan.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700 dark:bg-slate-800/35 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Reserva #{plan.id}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          plan.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : plan.status === "active"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {statusLabel(plan.status)}
                        </span>
                      </div>
                      <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{plan.clientName}</p>
                      {plan.clientPhone && <p className="text-sm text-slate-500">{plan.clientPhone}</p>}
                      <p className="mt-2 text-sm text-slate-500">
                        {plan.items.map((item) => `${item.name} x ${item.quantity}`).join(" · ")}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-500">Saldo pendiente</p>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                        ${Math.round(plan.balance).toLocaleString("es-AR")}
                      </p>
                      <p className="text-sm text-slate-500">
                        Pagado ${Math.round(plan.paidAmount).toLocaleString("es-AR")} de ${Math.round(plan.totalAmount).toLocaleString("es-AR")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>

                  {payingPlanId === plan.id ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                        <div>
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Importe</label>
                          <input
                            type="number"
                            min="0.01"
                            max={plan.balance}
                            step="0.01"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 font-bold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Forma de pago</p>
                          <div className="mt-1 grid grid-cols-3 gap-1">
                            {PAYMENT_METHODS.map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setPaymentMethod(method)}
                                className={`rounded-lg px-2 py-3 text-xs font-bold ${
                                  paymentMethod === method ? "bg-blue-600 text-white" : "border border-slate-200 dark:border-slate-600"
                                }`}
                              >
                                {getPaymentMethodLabel(method)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleAddPayment(plan)}
                          className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-slate-400"
                        >
                          Registrar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {plan.status === "active" && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayingPlanId(plan.id);
                            setPaymentAmount(String(plan.balance));
                          }}
                          className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
                        >
                          Agregar pago
                        </button>
                      )}
                      {plan.status === "paid" && (
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => void handleDeliver(plan)}
                          className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:bg-slate-400"
                        >
                          Marcar entregado
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
