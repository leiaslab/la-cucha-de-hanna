"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod, type StockUnit } from "./db";
import { formatQuantity, getLineTotal } from "./saleUtils";

interface DailySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProductSummary = {
  name: string;
  quantity: number;
  total: number;
  stockUnit: StockUnit;
};

export function DailySalesModal({ isOpen, onClose }: DailySalesModalProps) {
  const monthOrders = useLiveQuery(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return db.orders
      .where("createdAt")
      .between(start.getTime(), end.getTime(), true, true)
      .toArray();
  });

  const monthLabel = useMemo(
    () =>
      new Date().toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const totalSales = monthOrders?.reduce((acc, order) => acc + order.total, 0) || 0;
  const totalOrders = monthOrders?.length || 0;

  const paymentSummary = useMemo(() => {
    const base: Record<PaymentMethod, number> = {
      cash: 0,
      mercado_pago: 0,
      transfer: 0,
    };

    if (!monthOrders) {
      return base;
    }

    monthOrders.forEach((order) => {
      const method = order.paymentMethod || "cash";
      if (base[method] !== undefined) {
        base[method] += order.total;
      }
    });

    return base;
  }, [monthOrders]);

  const productSummary = useMemo(() => {
    if (!monthOrders) {
      return [] as ProductSummary[];
    }

    const stats = new Map<string, ProductSummary>();

    monthOrders.forEach((order) => {
      order.items.forEach((item) => {
        const current = stats.get(item.name);
        if (current) {
          current.quantity += item.quantity;
          current.total += getLineTotal(item);
          return;
        }

        stats.set(item.name, {
          name: item.name,
          quantity: item.quantity,
          total: getLineTotal(item),
          stockUnit: item.stockUnit,
        });
      });
    });

    return Array.from(stats.values()).sort((a, b) => b.total - a.total);
  }, [monthOrders]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm print:hidden">
        <div className="flex max-h-[84vh] w-full max-w-4xl flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                Resumen de ventas del mes
              </h2>
              <p className="mt-1 text-sm font-medium capitalize text-slate-500 dark:text-slate-400">
                {monthLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Exportar PDF
              </button>
              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Ventas totales</p>
              <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                ${totalSales.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Pedidos realizados
              </p>
              <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                {totalOrders}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Productos vendidos
              </p>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {productSummary.length}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
              <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                Promedio por venta
              </p>
              <p className="text-3xl font-extrabold text-violet-900 dark:text-violet-100">
                $
                {totalOrders > 0
                  ? Math.round(totalSales / totalOrders).toLocaleString("es-AR")
                  : 0}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
                Efectivo
              </p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                ${paymentSummary.cash.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-500">
                Mercado Pago
              </p>
              <p className="mt-2 text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                ${paymentSummary.mercado_pago.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-500">
                Transferencia
              </p>
              <p className="mt-2 text-3xl font-extrabold text-amber-900 dark:text-amber-100">
                ${paymentSummary.transfer.toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="grid flex-1 gap-6 overflow-hidden">
            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                Resumen por productos
              </h3>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {monthOrders === undefined ? (
                  <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando ventas...
                  </p>
                ) : productSummary.length === 0 ? (
                  <p className="py-10 text-center italic text-slate-500 dark:text-slate-400">
                    No hubo ventas este mes todavia.
                  </p>
                ) : (
                  productSummary.map((product) => (
                    <div
                      key={product.name}
                      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Cantidad vendida: {formatQuantity(product.quantity, product.stockUnit)}
                          </p>
                        </div>
                        <p className="shrink-0 text-base font-black text-blue-600 dark:text-blue-400">
                          ${product.total.toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="month-summary-print hidden bg-white px-6 py-6 text-black print:block">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-5 border-b border-black pb-3">
            <h1 className="text-2xl font-black uppercase">La cucha de Hanna</h1>
            <p className="mt-1 text-sm font-medium capitalize">Resumen de ventas del mes - {monthLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Ventas totales</p>
              <p className="mt-1 text-2xl font-black">${totalSales.toLocaleString("es-AR")}</p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Pedidos</p>
              <p className="mt-1 text-2xl font-black">{totalOrders}</p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Efectivo</p>
              <p className="mt-1 text-xl font-black">${paymentSummary.cash.toLocaleString("es-AR")}</p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Mercado Pago</p>
              <p className="mt-1 text-xl font-black">
                ${paymentSummary.mercado_pago.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Transferencia</p>
              <p className="mt-1 text-xl font-black">
                ${paymentSummary.transfer.toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Productos vendidos</p>
              <p className="mt-1 text-xl font-black">{productSummary.length}</p>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.18em]">Resumen por productos</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase">
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right">Cantidad</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {productSummary.map((product) => (
                  <tr key={product.name} className="border-b border-gray-200">
                    <td className="py-2 font-medium">{product.name}</td>
                    <td className="py-2 text-right">
                      {formatQuantity(product.quantity, product.stockUnit)}
                    </td>
                    <td className="py-2 text-right">${product.total.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
