"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { formatPriceLabel, formatQuantity } from "./saleUtils";

interface StockCostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StockCostModal({ isOpen, onClose }: StockCostModalProps) {
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

  const totals = useMemo(() => {
    return sortedProducts.reduce(
      (acc, product) => {
        const cost = product.cost ?? product.price ?? 0;
        const displayedStock = product.globalStock ?? product.stock;
        acc.totalCost += cost * displayedStock;
        acc.totalSale += product.price * displayedStock;
        return acc;
      },
      { totalCost: 0, totalSale: 0 },
    );
  }, [sortedProducts]);

  const estimatedMargin = totals.totalSale - totals.totalCost;

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
                Coste de stock
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Dinero invertido en el inventario actual.
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
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                Coste total
              </p>
              <p className="text-3xl font-extrabold text-rose-900 dark:text-rose-100">
                ${Math.round(totals.totalCost).toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Valor de venta
              </p>
              <p className="text-3xl font-extrabold text-blue-900 dark:text-blue-100">
                ${Math.round(totals.totalSale).toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Margen estimado
              </p>
              <p className="text-3xl font-extrabold text-emerald-900 dark:text-emerald-100">
                ${Math.round(estimatedMargin).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            {products === undefined ? (
              <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                Cargando coste de stock...
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
                      <th className="px-4 py-3 font-semibold">Cantidad</th>
                      <th className="px-4 py-3 text-right font-semibold">Costo</th>
                      <th className="px-4 py-3 text-right font-semibold">Precio venta</th>
                      <th className="px-4 py-3 text-right font-semibold">Coste total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product) => {
                      const displayedStock = product.globalStock ?? product.stock;
                      const costValue = (product.cost ?? product.price ?? 0) * displayedStock;

                      return (
                        <tr
                          key={product.id}
                          className="border-t border-slate-200 bg-white text-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                            {product.name}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {formatQuantity(displayedStock, product.stockUnit)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                            {product.saleType === "weight"
                              ? `$${(product.cost ?? product.price ?? 0).toLocaleString("es-AR")} / ${
                                  product.stockUnit === "liter" ? "l" : "kg"
                                }`
                              : `$${(product.cost ?? product.price ?? 0).toLocaleString("es-AR")}`}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                            {formatPriceLabel(product)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-blue-600 dark:text-blue-400">
                            ${Math.round(costValue).toLocaleString("es-AR")}
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
            <p className="mt-1 text-sm font-medium">Coste de stock actual</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Coste total</p>
              <p className="mt-1 text-2xl font-black">
                ${Math.round(totals.totalCost).toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                Valor de venta
              </p>
              <p className="mt-1 text-2xl font-black">
                ${Math.round(totals.totalSale).toLocaleString("es-AR")}
              </p>
            </div>
            <div className="rounded-xl border border-black px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                Margen estimado
              </p>
              <p className="mt-1 text-2xl font-black">
                ${Math.round(estimatedMargin).toLocaleString("es-AR")}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black text-[10px] uppercase">
                  <th className="py-2">Producto</th>
                  <th className="py-2">Cantidad</th>
                  <th className="py-2 text-right">Costo</th>
                  <th className="py-2 text-right">Precio venta</th>
                  <th className="py-2 text-right">Coste total</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {sortedProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-200">
                    <td className="py-2 font-medium">{product.name}</td>
                    <td className="py-2">{formatQuantity(product.globalStock ?? product.stock, product.stockUnit)}</td>
                    <td className="py-2 text-right">
                      {product.saleType === "weight"
                        ? `$${(product.cost ?? product.price ?? 0).toLocaleString("es-AR")} / ${
                            product.stockUnit === "liter" ? "l" : "kg"
                          }`
                        : `$${(product.cost ?? product.price ?? 0).toLocaleString("es-AR")}`}
                    </td>
                    <td className="py-2 text-right">{formatPriceLabel(product)}</td>
                    <td className="py-2 text-right">
                      ${Math.round((product.cost ?? product.price ?? 0) * (product.globalStock ?? product.stock)).toLocaleString("es-AR")}
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
