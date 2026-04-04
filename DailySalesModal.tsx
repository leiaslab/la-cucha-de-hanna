"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod, type StockUnit } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { formatQuantity, getLineTotal } from "./saleUtils";
import { escapeReportHtml, openPrintWindow } from "./src/lib/report-print";
import { useAuth } from "./src/components/AuthGate";

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

type EntitySummary = {
  label: string;
  orderCount: number;
  total: number;
};

type CalendarDaySummary = {
  dateKey: string;
  dayNumber: number;
  total: number;
  orderCount: number;
  isCurrentMonth: boolean;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DailySalesModal({ isOpen, onClose }: DailySalesModalProps) {
  const { user } = useAuth();
  const [selectedCashier, setSelectedCashier] = useState("all");
  const [selectedLocal, setSelectedLocal] = useState("all");
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
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

  const cashierOptions = useMemo(() => {
    if (!monthOrders) {
      return [];
    }

    return Array.from(
      new Set(monthOrders.map((order) => order.userFullName ?? order.userId?.toString() ?? "Sin usuario")),
    ).sort((a, b) => a.localeCompare(b));
  }, [monthOrders]);

  const localOptions = useMemo(() => {
    if (!monthOrders) {
      return [];
    }

    return Array.from(new Set(monthOrders.map((order) => order.localName ?? "Sin local"))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [monthOrders]);

  const filteredMonthOrders = useMemo(() => {
    if (!monthOrders) {
      return [] as NonNullable<typeof monthOrders>;
    }

    return monthOrders.filter((order) => {
      const cashierLabel = order.userFullName ?? order.userId?.toString() ?? "Sin usuario";
      const localLabel = order.localName ?? "Sin local";
      const matchesCashier = selectedCashier === "all" || cashierLabel === selectedCashier;
      const matchesLocal = selectedLocal === "all" || localLabel === selectedLocal;
      return matchesCashier && matchesLocal;
    });
  }, [monthOrders, selectedCashier, selectedLocal]);

  const totalSales = filteredMonthOrders.reduce((acc, order) => acc + order.total, 0);
  const totalOrders = filteredMonthOrders.length;

  const paymentSummary = useMemo(() => {
    const base: Record<PaymentMethod, number> = {
      cash: 0,
      mercado_pago: 0,
      transfer: 0,
    };

    if (!filteredMonthOrders) {
      return base;
    }

    filteredMonthOrders.forEach((order) => {
      const method = order.paymentMethod || "cash";
      if (base[method] !== undefined) {
        base[method] += order.total;
      }
    });

    return base;
  }, [filteredMonthOrders]);

  const productSummary = useMemo(() => {
    if (!filteredMonthOrders) {
      return [] as ProductSummary[];
    }

    const stats = new Map<string, ProductSummary>();

    filteredMonthOrders.forEach((order) => {
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
  }, [filteredMonthOrders]);

  const cashierSummary = useMemo(() => {
    if (!filteredMonthOrders) {
      return [] as EntitySummary[];
    }

    const summary = new Map<string, EntitySummary>();

    filteredMonthOrders.forEach((order) => {
      const label = order.userFullName ?? order.userId?.toString() ?? "Sin usuario";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [filteredMonthOrders]);

  const localSummary = useMemo(() => {
    if (!filteredMonthOrders) {
      return [] as EntitySummary[];
    }

    const summary = new Map<string, EntitySummary>();

    filteredMonthOrders.forEach((order) => {
      const label = order.localName ?? "Sin local";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [filteredMonthOrders]);

  const calendarSalesMap = useMemo(() => {
    const summary = new Map<string, { total: number; orderCount: number }>();

    filteredMonthOrders.forEach((order) => {
      const dateKey = toDateKey(new Date(order.createdAt));
      const current = summary.get(dateKey) ?? { total: 0, orderCount: 0 };
      current.total += order.total;
      current.orderCount += 1;
      summary.set(dateKey, current);
    });

    return summary;
  }, [filteredMonthOrders]);

  const resolvedSelectedDateKey = useMemo(() => {
    if (filteredMonthOrders.length === 0) {
      return selectedDateKey;
    }

    const hasSelectedDaySales = filteredMonthOrders.some(
      (order) => toDateKey(new Date(order.createdAt)) === selectedDateKey,
    );

    if (hasSelectedDaySales) {
      return selectedDateKey;
    }

    return toDateKey(new Date(filteredMonthOrders[0].createdAt));
  }, [filteredMonthOrders, selectedDateKey]);

  const selectedDayOrders = useMemo(() => {
    return filteredMonthOrders
      .filter((order) => toDateKey(new Date(order.createdAt)) === resolvedSelectedDateKey)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredMonthOrders, resolvedSelectedDateKey]);

  const selectedDayLabel = useMemo(() => {
    const [year, month, day] = resolvedSelectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [resolvedSelectedDateKey]);

  const selectedDayCashierSummary = useMemo(() => {
    const summary = new Map<string, EntitySummary>();

    selectedDayOrders.forEach((order) => {
      const label = order.userFullName ?? order.userId?.toString() ?? "Sin usuario";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [selectedDayOrders]);

  const selectedDayLocalSummary = useMemo(() => {
    const summary = new Map<string, EntitySummary>();

    selectedDayOrders.forEach((order) => {
      const label = order.localName ?? "Sin local";
      const current = summary.get(label) ?? { label, orderCount: 0, total: 0 };
      current.orderCount += 1;
      current.total += order.total;
      summary.set(label, current);
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [selectedDayOrders]);

  const selectedDayTotal = useMemo(
    () => selectedDayOrders.reduce((acc, order) => acc + order.total, 0),
    [selectedDayOrders],
  );

  const calendarDays = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstGridDay = new Date(firstDay);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    firstGridDay.setDate(firstDay.getDate() - startWeekday);

    const days: CalendarDaySummary[] = [];
    for (let index = 0; index < 42; index += 1) {
      const current = new Date(firstGridDay);
      current.setDate(firstGridDay.getDate() + index);
      const dateKey = toDateKey(current);
      const summary = calendarSalesMap.get(dateKey);

      days.push({
        dateKey,
        dayNumber: current.getDate(),
        total: summary?.total ?? 0,
        orderCount: summary?.orderCount ?? 0,
        isCurrentMonth: current.getMonth() === now.getMonth(),
      });
    }

    return days;
  }, [calendarSalesMap]);

  const handleExportPdf = () => {
    const cashierRows =
      cashierSummary.length > 0
        ? cashierSummary
            .map(
              (item) => `
                <tr>
                  <td>${escapeReportHtml(item.label)}</td>
                  <td class="center">${item.orderCount}</td>
                  <td class="right">$${item.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="3" class="center muted">Sin ventas por cajero.</td></tr>`;

    const localRows =
      localSummary.length > 0
        ? localSummary
            .map(
              (item) => `
                <tr>
                  <td>${escapeReportHtml(item.label)}</td>
                  <td class="center">${item.orderCount}</td>
                  <td class="right">$${item.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="3" class="center muted">Sin ventas por local.</td></tr>`;

    const selectedDayRows =
      selectedDayOrders.length > 0
        ? selectedDayOrders
            .map(
              (order) => `
                <tr>
                  <td>#${order.id}</td>
                  <td>${new Date(order.createdAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</td>
                  <td>${escapeReportHtml(order.localName ?? "Sin local")}</td>
                  <td>${escapeReportHtml(order.userFullName ?? order.userId?.toString() ?? "Sin usuario")}</td>
                  <td>${escapeReportHtml(order.paymentMethod ? getPaymentMethodLabel(order.paymentMethod) : "Sin forma de pago")}</td>
                  <td class="right">$${order.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="6" class="center muted">No hubo ventas en la fecha seleccionada.</td></tr>`;

    const productRows =
      productSummary.length > 0
        ? productSummary
            .map(
              (product) => `
                <tr>
                  <td>${escapeReportHtml(product.name)}</td>
                  <td class="right">${escapeReportHtml(formatQuantity(product.quantity, product.stockUnit))}</td>
                  <td class="right">$${product.total.toLocaleString("es-AR")}</td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="3" class="center muted">No hubo ventas este mes.</td></tr>`;

    openPrintWindow(
      "Resumen de ventas del mes",
      `
        <h1>Resumen de ventas del mes</h1>
        <p class="muted">${escapeReportHtml(monthLabel)}</p>

        <div class="cards cards-4">
          <div class="card"><div class="label">Ventas totales</div><div class="value">$${totalSales.toLocaleString("es-AR")}</div></div>
          <div class="card"><div class="label">Pedidos realizados</div><div class="value">${totalOrders}</div></div>
          <div class="card"><div class="label">Productos vendidos</div><div class="value">${productSummary.length}</div></div>
          <div class="card"><div class="label">Promedio por venta</div><div class="value">$${(totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0).toLocaleString("es-AR")}</div></div>
        </div>

        <div class="cards cards-3">
          <div class="card"><div class="label">Efectivo</div><div class="value">$${paymentSummary.cash.toLocaleString("es-AR")}</div></div>
          <div class="card"><div class="label">Mercado Pago</div><div class="value">$${paymentSummary.mercado_pago.toLocaleString("es-AR")}</div></div>
          <div class="card"><div class="label">Transferencia</div><div class="value">$${paymentSummary.transfer.toLocaleString("es-AR")}</div></div>
        </div>

        <div class="sections sections-2">
          <section class="section">
            <h2>Ventas del mes por cajero</h2>
            <table>
              <thead><tr><th>Cajero</th><th class="center">Ventas</th><th class="right">Total</th></tr></thead>
              <tbody>${cashierRows}</tbody>
            </table>
          </section>
          <section class="section">
            <h2>Ventas del mes por local</h2>
            <table>
              <thead><tr><th>Local</th><th class="center">Ventas</th><th class="right">Total</th></tr></thead>
              <tbody>${localRows}</tbody>
            </table>
          </section>
        </div>

        <div class="sections sections-2">
          <section class="section">
            <h2>Detalle de la fecha seleccionada</h2>
            <p class="muted" style="margin-bottom: 10px;">${escapeReportHtml(selectedDayLabel)}</p>
            <table>
              <thead><tr><th>ID</th><th>Hora</th><th>Local</th><th>Cajero</th><th>Pago</th><th class="right">Total</th></tr></thead>
              <tbody>${selectedDayRows}</tbody>
            </table>
          </section>
          <section class="section">
            <h2>Resumen por productos</h2>
            <table>
              <thead><tr><th>Producto</th><th class="right">Cantidad</th><th class="right">Total</th></tr></thead>
              <tbody>${productRows}</tbody>
            </table>
          </section>
        </div>
      `,
      () => window.print(),
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm print:hidden">
        <div className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition-colors dark:border-slate-800 dark:bg-slate-900">
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
                type="button"
                onClick={handleExportPdf}
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

          <div className="flex-1 overflow-y-auto pr-1">

          {user?.role === "admin" && (
            <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Filtrar por cajero
                </label>
                <select
                  value={selectedCashier}
                  onChange={(event) => setSelectedCashier(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos los cajeros</option>
                  {cashierOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Filtrar por local
                </label>
                <select
                  value={selectedLocal}
                  onChange={(event) => setSelectedLocal(event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos los locales</option>
                  {localOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

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

          {user?.role === "admin" && (
            <div className="mb-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ventas del mes por cajero
                </h3>
                <div className="space-y-3">
                  {cashierSummary.length === 0 ? (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      Todavia no hay ventas para mostrar.
                    </p>
                  ) : (
                    cashierSummary.map((item) => (
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

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ventas del mes por local
                </h3>
                <div className="space-y-3">
                  {localSummary.length === 0 ? (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      Todavia no hay ventas para mostrar.
                    </p>
                  ) : (
                    localSummary.map((item) => (
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
            </div>
          )}

          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Calendario de ventas
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Toca un dia para ver el detalle por local y cajero.
                </p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                {selectedDayLabel}
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const isSelected = day.dateKey === resolvedSelectedDateKey;

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(day.dateKey)}
                    className={`min-h-[88px] rounded-2xl border px-2 py-2 text-left transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                    } ${day.isCurrentMonth ? "" : "opacity-45"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                        {day.dayNumber}
                      </span>
                      {day.orderCount > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {day.orderCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      ${Math.round(day.total).toLocaleString("es-AR")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            {user?.role === "admin" && (
              <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  {`Ventas del dia: ${selectedDayLabel}`}
                </h3>

                <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-500">
                      Total del dia
                    </p>
                    <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">
                      ${selectedDayTotal.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-500">
                      Pedidos del dia
                    </p>
                    <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">
                      {selectedDayOrders.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-500">
                      Promedio del dia
                    </p>
                    <p className="mt-2 text-2xl font-black text-violet-900 dark:text-violet-100">
                      $
                      {selectedDayOrders.length > 0
                        ? Math.round(selectedDayTotal / selectedDayOrders.length).toLocaleString("es-AR")
                        : 0}
                    </p>
                  </div>
                </div>

                <div className="grid min-h-0 gap-4 xl:grid-cols-2">
                  <div className="space-y-3 overflow-y-auto pr-1">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Por cajero
                    </p>
                    {selectedDayCashierSummary.length === 0 ? (
                      <p className="text-sm italic text-slate-500 dark:text-slate-400">
                        Sin ventas en ese dia.
                      </p>
                    ) : (
                      selectedDayCashierSummary.map((item) => (
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
                          <p className="text-base font-black text-blue-600 dark:text-blue-400">
                            ${item.total.toLocaleString("es-AR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Por local
                    </p>
                    {selectedDayLocalSummary.length === 0 ? (
                      <p className="text-sm italic text-slate-500 dark:text-slate-400">
                        Sin ventas en ese dia.
                      </p>
                    ) : (
                      selectedDayLocalSummary.map((item) => (
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
                          <p className="text-base font-black text-blue-600 dark:text-blue-400">
                            ${item.total.toLocaleString("es-AR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            <div className="grid min-h-0 gap-6">
              <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Detalle de ventas del dia elegido
                </h3>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {monthOrders === undefined ? (
                    <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                      Cargando ventas...
                    </p>
                  ) : selectedDayOrders.length === 0 ? (
                    <p className="py-10 text-center italic text-slate-500 dark:text-slate-400">
                      No hubo ventas en la fecha seleccionada.
                    </p>
                  ) : (
                    selectedDayOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div>
                            <p className="font-bold text-slate-700 dark:text-slate-100">
                              #{order.id}{" "}
                              {new Date(order.createdAt).toLocaleTimeString("es-AR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {order.localName ?? "Sin local"} • {order.userFullName ?? order.userId ?? "Sin usuario"}
                            </p>
                          </div>
                          <p className="text-base font-black text-blue-600 dark:text-blue-400">
                            ${order.total.toLocaleString("es-AR")}
                          </p>
                        </div>

                        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                          {order.items
                            .map((item) => `${formatQuantity(item.quantity, item.stockUnit)} ${item.name}`)
                            .join(", ")}
                        </div>

                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {order.paymentMethod
                            ? `Pago: ${getPaymentMethodLabel(order.paymentMethod)}`
                            : "Sin forma de pago"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

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
