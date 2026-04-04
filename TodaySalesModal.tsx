"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { useAuth } from "./src/components/AuthGate";

interface TodaySalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntitySummary = {
  label: string;
  orderCount: number;
  total: number;
};

type LiveSaleSummary = {
  id?: number;
  total: number;
  createdAt: number;
  paymentMethod?: PaymentMethod;
  userLabel: string;
  localLabel: string;
  itemCount: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function TodaySalesModal({ isOpen, onClose }: TodaySalesModalProps) {
  const { user } = useAuth();
  const todayOrders = useLiveQuery(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return db.orders
      .where("createdAt")
      .between(start.getTime(), end.getTime(), true, true)
      .toArray();
  });

  const dayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const totalSales = todayOrders?.reduce((acc, order) => acc + order.total, 0) || 0;
  const totalOrders = todayOrders?.length || 0;

  const paymentSummary = useMemo(() => {
    const base: Record<PaymentMethod, number> = {
      cash: 0,
      mercado_pago: 0,
      transfer: 0,
    };

    if (!todayOrders) {
      return base;
    }

    todayOrders.forEach((order) => {
      const method = order.paymentMethod || "cash";
      if (base[method] !== undefined) {
        base[method] += order.total;
      }
    });

    return base;
  }, [todayOrders]);

  const soldProductsCount = useMemo(() => {
    if (!todayOrders) {
      return 0;
    }

    return new Set(
      todayOrders.flatMap((order) => order.items.map((item) => `${item.productId ?? item.name}-${item.name}`)),
    ).size;
  }, [todayOrders]);

  const cashierSummary = useMemo(() => {
    if (!todayOrders) {
      return [] as EntitySummary[];
    }

    const summary = new Map<string, EntitySummary>();

    todayOrders.forEach((order) => {
      const label = order.userFullName ?? order.userId?.toString() ?? "Sin usuario";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [todayOrders]);

  const localSummary = useMemo(() => {
    if (!todayOrders) {
      return [] as EntitySummary[];
    }

    const summary = new Map<string, EntitySummary>();

    todayOrders.forEach((order) => {
      const label = order.localName ?? "Sin local";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [todayOrders]);

  const liveSales = useMemo(() => {
    if (!todayOrders) {
      return [] as LiveSaleSummary[];
    }

    return todayOrders
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((order) => ({
        id: order.id,
        total: order.total,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        userLabel: order.userFullName ?? order.userId?.toString() ?? "Sin usuario",
        localLabel: order.localName ?? "Sin local",
        itemCount: order.items.length,
      }));
  }, [todayOrders]);

  const topCashierSummary = cashierSummary.slice(0, 12);
  const topLocalSummary = localSummary.slice(0, 12);
  const recentLiveSales = liveSales.slice(0, 20);

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank", "width=960,height=720");

    if (!printWindow) {
      window.print();
      return;
    }

    const cashierRows =
      topCashierSummary.length > 0
        ? topCashierSummary
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.label)}</td>
                  <td style="text-align:center;">${item.orderCount}</td>
                  <td style="text-align:right;">$${item.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="3" style="text-align:center; color:#64748b;">Sin ventas para mostrar.</td></tr>`;

    const localRows =
      topLocalSummary.length > 0
        ? topLocalSummary
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.label)}</td>
                  <td style="text-align:center;">${item.orderCount}</td>
                  <td style="text-align:right;">$${item.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="3" style="text-align:center; color:#64748b;">Sin ventas para mostrar.</td></tr>`;

    const liveRows =
      recentLiveSales.length > 0
        ? recentLiveSales
            .map(
              (sale) => `
                <tr>
                  <td>${escapeHtml(sale.localLabel)}</td>
                  <td>${escapeHtml(sale.userLabel)}</td>
                  <td>${new Date(sale.createdAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</td>
                  <td>${escapeHtml(sale.paymentMethod ? getPaymentMethodLabel(sale.paymentMethod) : "Sin forma de pago")}</td>
                  <td style="text-align:right;">$${sale.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="5" style="text-align:center; color:#64748b;">Sin ventas en vivo para mostrar.</td></tr>`;

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Ventas de hoy</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { margin: 0 0 6px; font-size: 28px; }
            p { margin: 0; }
            .muted { color: #64748b; }
            .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0 18px; }
            .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 14px; }
            .label { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
            .value { margin-top: 8px; font-size: 28px; font-weight: 800; }
            .sections { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
            .section { border: 1px solid #cbd5e1; border-radius: 18px; padding: 14px; }
            .section h2 { margin: 0 0 12px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
            th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; }
            @media print {
              @page { margin: 10mm; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Ventas de hoy</h1>
          <p class="muted">${escapeHtml(dayLabel)}</p>

          <div class="cards">
            <div class="card"><div class="label">Ventas totales</div><div class="value">$${totalSales.toLocaleString("es-AR")}</div></div>
            <div class="card"><div class="label">Pedidos realizados</div><div class="value">${totalOrders}</div></div>
            <div class="card"><div class="label">Productos vendidos</div><div class="value">${soldProductsCount}</div></div>
            <div class="card"><div class="label">Promedio por venta</div><div class="value">$${(totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0).toLocaleString("es-AR")}</div></div>
          </div>

          <div class="cards" style="grid-template-columns: repeat(3, 1fr);">
            <div class="card"><div class="label">Efectivo</div><div class="value">$${paymentSummary.cash.toLocaleString("es-AR")}</div></div>
            <div class="card"><div class="label">Mercado Pago</div><div class="value">$${paymentSummary.mercado_pago.toLocaleString("es-AR")}</div></div>
            <div class="card"><div class="label">Transferencia</div><div class="value">$${paymentSummary.transfer.toLocaleString("es-AR")}</div></div>
          </div>

          <div class="sections">
            <section class="section">
              <h2>Ventas por cajero</h2>
              <table>
                <thead><tr><th>Cajero</th><th style="text-align:center;">Ventas</th><th style="text-align:right;">Total</th></tr></thead>
                <tbody>${cashierRows}</tbody>
              </table>
            </section>
            <section class="section">
              <h2>Ventas por local</h2>
              <table>
                <thead><tr><th>Local</th><th style="text-align:center;">Ventas</th><th style="text-align:right;">Total</th></tr></thead>
                <tbody>${localRows}</tbody>
              </table>
            </section>
            <section class="section">
              <h2>Ventas en vivo</h2>
              <table>
                <thead><tr><th>Local</th><th>Cajero</th><th>Hora</th><th>Pago</th><th style="text-align:right;">Total</th></tr></thead>
                <tbody>${liveRows}</tbody>
              </table>
            </section>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm print:hidden">
      <div className="flex h-[84vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Ventas de hoy</h2>
            <p className="mt-1 text-sm font-medium capitalize text-slate-500 dark:text-slate-400">
              {dayLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3.5 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Ventas totales</p>
            <p className="text-[2rem] font-extrabold leading-none text-blue-900 dark:text-blue-100">
              ${totalSales.toLocaleString("es-AR")}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Pedidos realizados</p>
            <p className="text-[2rem] font-extrabold leading-none text-emerald-900 dark:text-emerald-100">
              {totalOrders}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Productos vendidos</p>
            <p className="text-[2rem] font-extrabold leading-none text-slate-900 dark:text-slate-100">
              {soldProductsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3.5 dark:border-violet-800 dark:bg-violet-900/20">
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Promedio por venta</p>
            <p className="text-[2rem] font-extrabold leading-none text-violet-900 dark:text-violet-100">
              ${(totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0).toLocaleString("es-AR")}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {(["cash", "mercado_pago", "transfer"] as PaymentMethod[]).map((method) => (
            <div
              key={method}
              className={`rounded-2xl border p-3.5 ${
                method === "cash"
                  ? "border-emerald-100 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                  : method === "mercado_pago"
                    ? "border-blue-100 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                    : "border-amber-100 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
              }`}
            >
              <p
                className={`text-xs font-bold uppercase tracking-[0.22em] ${
                  method === "cash"
                    ? "text-emerald-500"
                    : method === "mercado_pago"
                      ? "text-blue-500"
                      : "text-amber-500"
                }`}
              >
                {getPaymentMethodLabel(method)}
              </p>
              <p
                className={`mt-2 text-[2rem] font-extrabold leading-none ${
                  method === "cash"
                    ? "text-emerald-900 dark:text-emerald-100"
                    : method === "mercado_pago"
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-amber-900 dark:text-amber-100"
                }`}
              >
                ${paymentSummary[method].toLocaleString("es-AR")}
              </p>
            </div>
          ))}
        </div>

        {user?.role === "admin" && (
          <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Ventas por cajero</h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {topCashierSummary.length === 0 ? (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Todavia no hay ventas para mostrar.
                  </p>
                ) : (
                  topCashierSummary.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.orderCount} venta{item.orderCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                        ${item.total.toLocaleString("es-AR")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Ventas por local</h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {topLocalSummary.length === 0 ? (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Todavia no hay ventas para mostrar.
                  </p>
                ) : (
                  topLocalSummary.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.orderCount} venta{item.orderCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                        ${item.total.toLocaleString("es-AR")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Ventas en vivo</h3>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {recentLiveSales.length === 0 ? (
                  <p className="text-sm italic text-slate-500 dark:text-slate-400">
                    Todavia no hay ventas para mostrar.
                  </p>
                ) : (
                  recentLiveSales.map((sale) => (
                    <div
                      key={`${sale.id}-${sale.createdAt}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{sale.localLabel}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{sale.userLabel}</p>
                        </div>
                        <p className="text-base font-black text-blue-600 dark:text-blue-400">
                          ${sale.total.toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {new Date(sale.createdAt).toLocaleTimeString("es-AR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>{sale.itemCount} item{sale.itemCount === 1 ? "" : "s"}</span>
                        <span>
                          {sale.paymentMethod ? getPaymentMethodLabel(sale.paymentMethod) : "Sin forma de pago"}
                        </span>
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
