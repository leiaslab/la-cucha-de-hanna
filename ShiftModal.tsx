"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { closeShiftRemote, openShiftRemote } from "./src/lib/api-client";
import { downloadPdfResult } from "./src/lib/pdf-download";
import { formatQuantity } from "./saleUtils";
import { showToast } from "./Toast";

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ShiftProductSummary = {
  name: string;
  quantity: number;
  stockUnit: "unit" | "kg" | "liter";
};

export function ShiftModal({ isOpen, onClose }: ShiftModalProps) {
  const [openingCash, setOpeningCash] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [closingNote, setClosingNote] = useState("");

  const activeShift = useLiveQuery(() => db.shifts.where("status").equals("open").first());
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

    return base;
  }, [shiftOrders]);

  const totalSales = useMemo(
    () => (shiftOrders ?? []).reduce((acc, order) => acc + order.total, 0),
    [shiftOrders],
  );

  const productSummary = useMemo(() => {
    const stats = new Map<string, ShiftProductSummary>();

    (shiftOrders ?? []).forEach((order) => {
      order.items.forEach((item) => {
        const current = stats.get(item.name);
        if (current) {
          current.quantity += item.quantity;
          return;
        }

        stats.set(item.name, {
          name: item.name,
          quantity: item.quantity,
          stockUnit: item.stockUnit,
        });
      });
    });

    return Array.from(stats.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [shiftOrders]);

  const handleOpenShift = async () => {
    const parsedOpeningCash = Number(openingCash);

    if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
      showToast("La caja inicial debe ser un numero valido.", "error");
      return;
    }

    await openShiftRemote({
      openingCash: parsedOpeningCash,
      openingNote: openingNote.trim() || undefined,
    });

    setOpeningCash("");
    setOpeningNote("");
    showToast("Turno abierto con exito.", "success");
  };

  const handleCloseShift = async () => {
    if (!activeShift?.id) {
      return;
    }

    const result = await closeShiftRemote(activeShift.id, {
      closingNote: closingNote.trim() || undefined,
      generatePdf: true,
    });

    setClosingNote("");
    if (result.pdf) {
      downloadPdfResult(result.pdf);
    }
    showToast("Turno cerrado con exito.", "success");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Apertura y cierre de turno
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Maneja la caja inicial y el resumen del turno activo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        {!activeShift ? (
          <div className="mx-auto w-full max-w-xl space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                No hay turno abierto.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Abre un turno para empezar a registrar las ventas dentro de una jornada.
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
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Abrir turno
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
                    ${Math.round(activeShift.openingCash + paymentSummary.cash).toLocaleString("es-AR")}
                  </p>
                </div>
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

              <div>
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

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCloseShift()}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                >
                  Cerrar turno
                </button>
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                Productos vendidos en el turno
              </h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {productSummary.length === 0 ? (
                  <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Todavia no hay ventas en este turno.
                  </p>
                ) : (
                  productSummary.map((product) => (
                    <div
                      key={product.name}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-slate-800 dark:text-slate-100">
                          {product.name}
                        </p>
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {formatQuantity(product.quantity, product.stockUnit)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
