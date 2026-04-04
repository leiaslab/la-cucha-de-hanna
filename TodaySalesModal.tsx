"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PaymentMethod, type StockUnit } from "./db";
import { getPaymentMethodLabel } from "./PaymentMethodDialog";
import { formatQuantity, getLineTotal } from "./saleUtils";
import { useAuth } from "./src/components/AuthGate";

interface TodaySalesModalProps {
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

type LiveSaleSummary = {
  id?: number;
  total: number;
  createdAt: number;
  paymentMethod?: PaymentMethod;
  userLabel: string;
  localLabel: string;
  itemCount: number;
};

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

  const productSummary = useMemo(() => {
    if (!todayOrders) {
      return [] as ProductSummary[];
    }

    const stats = new Map<string, ProductSummary>();

    todayOrders.forEach((order) => {
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

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm print:hidden">
        <div className="flex max-h-[84vh] w-full max-w-5xl flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                Ventas de hoy
              </h2>
              <p className="mt-1 text-sm font-medium capitalize text-slate-500 dark:text-slate-400">
                {dayLabel}
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
            {(["cash", "mercado_pago", "transfer"] as PaymentMethod[]).map((method) => (
              <div
                key={method}
                className={`rounded-2xl border p-4 ${
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
                  className={`mt-2 text-3xl font-extrabold ${
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
            <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ventas por cajero
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
                  Ventas por local
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

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Ventas en vivo
                </h3>
                <div className="space-y-3">
                  {liveSales.length === 0 ? (
                    <p className="text-sm italic text-slate-500 dark:text-slate-400">
                      Todavia no hay ventas para mostrar.
                    </p>
                  ) : (
                    liveSales.slice(0, 8).map((sale) => (
                      <div
                        key={`${sale.id}-${sale.createdAt}`}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              {sale.localLabel}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {sale.userLabel}
                            </p>
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

          <div className="grid flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                Resumen por productos
              </h3>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {todayOrders === undefined ? (
                  <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando ventas...
                  </p>
                ) : productSummary.length === 0 ? (
                  <p className="py-10 text-center italic text-slate-500 dark:text-slate-400">
                    No hubo ventas registradas hoy.
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

            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                Detalle de pedidos del dia
              </h3>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {todayOrders === undefined ? (
                  <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando pedidos...
                  </p>
                ) : todayOrders.length === 0 ? (
                  <p className="py-10 text-center italic text-slate-500 dark:text-slate-400">
                    No hubo pedidos registrados hoy.
                  </p>
                ) : (
                  todayOrders
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((order) => (
                      <div
                        key={order.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50"
                      >
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold text-slate-600 dark:text-slate-300">
                            #{order.id}{" "}
                            {new Date(order.createdAt).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {order.paymentMethod
                              ? getPaymentMethodLabel(order.paymentMethod)
                              : "Sin forma de pago"}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                          {order.items
                            .map(
                              (item) =>
                                `${formatQuantity(item.quantity, item.stockUnit)} ${item.name}`,
                            )
                            .join(", ")}
                        </div>

                        <div className="mt-2 text-right text-base font-bold text-blue-600 dark:text-blue-400">
                          Total: ${order.total.toLocaleString("es-AR")}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="today-summary-print hidden bg-white px-6 py-6 text-black print:block">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-5 border-b border-black pb-3">
            <h1 className="text-2xl font-black uppercase">La cucha de Hanna</h1>
            <p className="mt-1 text-sm font-medium capitalize">Ventas de hoy - {dayLabel}</p>
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
