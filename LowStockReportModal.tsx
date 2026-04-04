"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { formatPriceLabel, formatQuantity } from "./saleUtils";

interface LowStockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LowStockReportModal({ isOpen, onClose }: LowStockReportModalProps) {
  const products = useLiveQuery(() => db.products.toArray());

  const sortedProducts = useMemo(
    () =>
      [...(products ?? [])].sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) {
          return categoryCompare;
        }

        return a.name.localeCompare(b.name);
      }),
    [products],
  );

  const totalInventoryValue = useMemo(
    () =>
      sortedProducts.reduce(
        (acc, product) => acc + product.price * (product.globalStock ?? product.stock),
        0,
      ),
    [sortedProducts],
  );

  const lowStockCount = useMemo(
    () =>
      sortedProducts.filter(
        (product) =>
          (product.globalStock ?? product.stock) <=
          Math.max(0, product.globalLowStockAlertThreshold ?? product.lowStockAlertThreshold ?? 5),
      ).length,
    [sortedProducts],
  );

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
                Reporte de stock
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Inventario actual segun los productos cargados.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Imprimir
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

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Productos cargados
              </p>
              <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                {sortedProducts.length}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Stock bajo
              </p>
              <p className="text-3xl font-extrabold text-amber-900 dark:text-amber-100">
                {lowStockCount}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Valor total de venta
              </p>
              <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                ${Math.round(totalInventoryValue).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            {products === undefined ? (
              <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                Cargando reporte...
              </p>
            ) : sortedProducts.length === 0 ? (
              <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                No hay productos cargados todavia.
              </p>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Categoria</th>
                      <th className="px-4 py-3 text-center font-semibold">Cantidad</th>
                      <th className="px-4 py-3 text-right font-semibold">Precio</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product) => {
                      const displayedStock = product.globalStock ?? product.stock;
                      const displayedThreshold =
                        product.globalLowStockAlertThreshold ?? product.lowStockAlertThreshold ?? 5;
                      const stockValue = product.price * displayedStock;

                      return (
                        <tr
                          key={product.id}
                          className="border-t border-slate-200 bg-white text-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {product.category}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                displayedStock <= 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : displayedStock <= Math.max(0, displayedThreshold)
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {formatQuantity(displayedStock, product.stockUnit)}
                            </span>
                            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                              alerta: {formatQuantity(displayedThreshold, product.stockUnit)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                            {formatPriceLabel(product)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-blue-600 dark:text-blue-400">
                            ${Math.round(stockValue).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden bg-white px-6 py-6 text-black print:block">
        <div className="mx-auto w-full max-w-[900px]">
          <div className="mb-5 border-b border-black pb-3">
            <h1 className="text-2xl font-black uppercase">La cucha de Hanna</h1>
            <p className="mt-1 text-sm font-medium">Reporte de stock actual</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Productos</p>
              <p className="mt-1 text-2xl font-black">{sortedProducts.length}</p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Stock bajo</p>
              <p className="mt-1 text-2xl font-black">{lowStockCount}</p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                Valor total de venta
              </p>
              <p className="mt-1 text-2xl font-black">
                ${Math.round(totalInventoryValue).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase">
                  <th className="py-2">Producto</th>
                  <th className="py-2">Categoria</th>
                  <th className="py-2 text-center">Cantidad</th>
                  <th className="py-2 text-right">Precio</th>
                  <th className="py-2 text-right">Valor stock</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {sortedProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-200">
                    <td className="py-2 font-medium">{product.name}</td>
                    <td className="py-2">{product.category}</td>
                    <td className="py-2 text-center">
                      {formatQuantity(product.globalStock ?? product.stock, product.stockUnit)}
                    </td>
                    <td className="py-2 text-right">{formatPriceLabel(product)}</td>
                    <td className="py-2 text-right">
                      ${Math.round(product.price * (product.globalStock ?? product.stock)).toLocaleString("es-AR")}
                    </td>
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
