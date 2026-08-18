"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod, type SessionUser } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { closeShiftRemote, openShiftRemote, registerShiftExpenseRemote } from "./src/lib/api-client";
import { downloadPdfResult } from "./src/lib/pdf-download";
import { showToast } from "./Toast";

interface ShiftModalProps {
  currentUser: SessionUser;
  isOpen: boolean;
  onClose: () => void;
  requireOpenShift?: boolean;
}

export function ShiftModal({
  currentUser,
  isOpen,
  onClose,
  requireOpenShift = false,
}: ShiftModalProps) {
  const [openingCash, setOpeningCash] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeShift = useLiveQuery(async () => {
    const openShifts = await db.shifts.where("status").equals("open").toArray();

    return (
      openShifts
        .filter((shift) => {
          if (currentUser.id === null) {
            return !shift.openedByUserId;
          }

          return shift.openedByUserId === currentUser.id;
        })
        .sort((a, b) => b.openedAt - a.openedAt)[0]
    );
  }, [currentUser.id]);
  const shiftOrders = useLiveQuery(
    () => (activeShift?.id ? db.orders.where("shiftId").equals(activeShift.id).toArray() : []),
    [activeShift?.id],
  );

  const paymentSummary = useMemo(() => {
    const base: Record<PaymentMethod, number> = {
      cash: 0,
      mercado_pago: 0,
      transfer: 0,
    };

    (shiftOrders ?? []).forEach((order) => {
      const method = order.paymentMethod ?? "cash";
      base[method] += order.total;
    });

    base.cash += activeShift?.reservationCash ?? 0;
    base.mercado_pago += activeShift?.reservationMercadoPago ?? 0;
    base.transfer += activeShift?.reservationTransfer ?? 0;

    return base;
  }, [activeShift?.reservationCash, activeShift?.reservationMercadoPago, activeShift?.reservationTransfer, shiftOrders]);

  const totalSales = useMemo(
    () => (shiftOrders ?? []).reduce((acc, order) => acc + order.total, 0),
    [shiftOrders],
  );
  const totalExpenses = activeShift?.cashExpenses ?? 0;

  const handleOpenShift = async () => {
    const parsedOpeningCash = Number(openingCash);

    if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
      showToast("La caja inicial debe ser un numero valido.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await openShiftRemote({
        openingCash: parsedOpeningCash,
        openingNote: openingNote.trim() || undefined,
      });
      setOpeningCash("");
      setOpeningNote("");
      showToast("Turno abierto con exito.", "success");
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo abrir el turno.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift?.id) return;

    const parsedCountedCash = Number(countedCash);
    if (!Number.isFinite(parsedCountedCash) || parsedCountedCash < 0) {
      showToast("Ingresa el efectivo contado antes de cerrar.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await closeShiftRemote(activeShift.id, {
        closingNote: closingNote.trim() || undefined,
        countedCash: parsedCountedCash,
        generatePdf: true,
      });
      setClosingNote("");
      setCountedCash("");
      if (result.pdf) {
        downloadPdfResult(result.pdf);
      }
      showToast("Turno cerrado con exito.", "success");
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo cerrar el turno.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterExpense = async () => {
    if (!activeShift?.id) return;

    const parsedAmount = Number(expenseAmount);
    const reason = expenseReason.trim();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast("El gasto debe tener un importe mayor que cero.", "error");
      return;
    }
    if (!reason) {
      showToast("Escribe el motivo del gasto.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerShiftExpenseRemote(activeShift.id, { amount: parsedAmount, reason });
      setExpenseAmount("");
      setExpenseReason("");
      showToast("Gasto registrado en la caja.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo registrar el gasto.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const isBlockingOpen = requireOpenShift && !activeShift;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm sm:py-6">
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-[2rem] sm:p-6 sm:max-h-[calc(100vh-3rem)]">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 sm:text-2xl">
              Apertura y cierre de turno
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isBlockingOpen
                ? "Abre un turno para habilitar el cobro y empezar la jornada."
                : "Maneja la caja inicial y el resumen del turno activo."}
            </p>
          </div>
          {!isBlockingOpen && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!activeShift ? (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No hay turno abierto.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {isBlockingOpen
                  ? "Abre un turno para empezar a registrar ventas y habilitar el cobro."
                  : "Abre un turno para empezar a registrar las ventas dentro de una jornada."}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="openingCash" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Caja inicial
                </label>
                <input
                  id="openingCash"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingCash}
                  onChange={(event) => setOpeningCash(event.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Ej: 25000"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="openingNote" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nota de apertura
                </label>
                <textarea
                  id="openingNote"
                  value={openingNote}
                  onChange={(event) => setOpeningNote(event.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleOpenShift()}
                disabled={isSubmitting}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? "Abriendo..." : "Abrir turno"}
              </button>
            </div>
          </div>
          ) : (
          <div className="min-h-0 flex-1">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-500">
                  Turno activo
                </p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">
                  Abierto el{" "}
                  {new Date(activeShift.openedAt).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}{" "}
                  a las{" "}
                  {new Date(activeShift.openedAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Caja inicial: ${Math.round(activeShift.openingCash).toLocaleString("es-AR")}
                </p>
                {activeShift.openingNote && (
                  <p className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                    {activeShift.openingNote}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Ventas del turno
                  </p>
                  <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                    ${Math.round(totalSales).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Pedidos
                  </p>
                  <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                    {shiftOrders?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Efectivo
                  </p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    ${Math.round(paymentSummary.cash).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Caja esperada
                  </p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    ${Math.round(activeShift.openingCash + paymentSummary.cash - totalExpenses).toLocaleString("es-AR")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Gastos de caja</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Se descuentan automaticamente de la caja esperada del turno.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-200">
                    -${Math.round(totalExpenses).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto]">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Importe"
                  />
                  <input
                    type="text"
                    maxLength={300}
                    value={expenseReason}
                    onChange={(event) => setExpenseReason(event.target.value)}
                    className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Motivo, por ejemplo: limpieza o mercaderia"
                  />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleRegisterExpense()}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Guardando..." : "Cargar gasto"}
                  </button>
                </div>
                {(activeShift.expenses ?? []).length > 0 && (
                  <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
                    {(activeShift.expenses ?? []).map((expense) => (
                      <div key={expense.id} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-slate-900/70">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{expense.reason}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(expense.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="shrink-0 font-black text-amber-700 dark:text-amber-300">
                          -${Math.round(expense.amount).toLocaleString("es-AR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Formas de pago
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  {(["cash", "mercado_pago", "transfer"] as PaymentMethod[]).map((method) => (
                    <div key={method} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">
                        {getPaymentMethodLabel(method)}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        ${Math.round(paymentSummary[method]).toLocaleString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="countedCash" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Efectivo contado
                  </label>
                  <input
                    id="countedCash"
                    type="number"
                    min="0"
                    step="0.01"
                    value={countedCash}
                    onChange={(event) => setCountedCash(event.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="Ej: 25000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="closingNote" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Nota de cierre
                  </label>
                  <textarea
                    id="closingNote"
                    value={closingNote}
                    onChange={(event) => setClosingNote(event.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCloseShift()}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSubmitting ? "Cerrando..." : "Cerrar turno"}
                </button>
              </div>
            </section>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
