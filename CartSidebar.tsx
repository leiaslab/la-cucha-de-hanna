"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Order } from "./db";
import { ClientSelector } from "./ClientSelector";
import { finalizeLocalOrder } from "./checkoutUtils";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import { ReceiptPrint } from "./ReceiptPrint";
import { formatQuantity, getLineTotal, getQuantityStep, roundQuantity } from "./saleUtils";
import { showToast } from "./Toast";

interface CartSidebarProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export function CartSidebar({ isDarkMode, onToggleTheme }: CartSidebarProps) {
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isPrintQueued, setIsPrintQueued] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const queuePrint = (order: Order) => {
    setPrintingOrder(order);
    setIsPrintQueued(true);

    const handleAfterPrint = () => {
      setPrintingOrder(null);
      setIsPrintQueued(false);
      window.removeEventListener("afterprint", handleAfterPrint);
    };

    window.addEventListener("afterprint", handleAfterPrint);
  };

  const cartItems = useLiveQuery(async () => {
    const items = await db.cart.toArray();
    const productIds = items.map((item) => item.productId);
    const products =
      productIds.length > 0 ? await db.products.where("id").anyOf(productIds).toArray() : [];

    return items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      const stockUnit = item.stockUnit ?? product?.stockUnit ?? "unit";

      return {
        ...item,
        stock: product?.stock ?? 0,
        stockUnit,
        step: item.step ?? getQuantityStep(stockUnit),
      };
    });
  });

  const total = cartItems?.reduce((acc, item) => acc + getLineTotal(item), 0) || 0;

  const handleUpdateQuantity = async (id: number, delta: number) => {
    const item = await db.cart.get(id);
    if (!item) {
      return;
    }

    if (delta > 0) {
      const product = await db.products.get(item.productId);
      if (product && item.quantity + delta > product.stock) {
        showToast(
          `No puedes agregar mas de "${item.name}". El stock actual es ${product.stock}.`,
          "error",
        );
        return;
      }
    }

    const newQuantity = roundQuantity(item.quantity + delta);
    if (newQuantity <= 0) {
      await db.cart.delete(id);
    } else {
      await db.cart.update(id, { quantity: newQuantity });
    }
  };

  const handleClearCart = async () => {
    if (confirm("Estas seguro de que deseas vaciar el carrito?")) {
      await db.cart.clear();
    }
  };

  const handleCheckout = async (paymentMethod: Order["paymentMethod"]) => {
    if (!cartItems || cartItems.length === 0) {
      return;
    }

    try {
      const result = await finalizeLocalOrder({
        cartItems,
        total,
        paymentMethod: paymentMethod ?? "cash",
        clientId: selectedClientId,
      });

      setIsPaymentDialogOpen(false);
      setSelectedClientId(null);
      showToast("Venta procesada con exito.", "success");

      if (result.order) {
        queuePrint(result.order);
      }
    } catch (error) {
      console.error("Error al finalizar el pedido:", error);
      showToast("No se pudo procesar la venta. Verifica el stock o la conexion.", "error");
    }
  };

  return (
    <>
      <aside className="hidden xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden xl:rounded-[2rem] xl:border xl:border-slate-200 xl:bg-white xl:p-5 xl:shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:bg-slate-900 dark:border-slate-800 print:hidden transition-colors duration-300">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {cartItems?.length || 0} producto{(cartItems?.length || 0) === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50"
            aria-pressed={isDarkMode}
            aria-label="Cambiar modo oscuro"
          >
            <div className="flex flex-col items-start leading-none">
              <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                Tema
              </span>
              <span>{isDarkMode ? "Oscuro" : "Claro"}</span>
            </div>
            <span
              className={`relative flex h-8 w-16 items-center rounded-full px-1 transition-colors ${
                isDarkMode ? "bg-slate-900" : "bg-amber-100"
              }`}
            >
              <span
                className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-transform ${
                  isDarkMode
                    ? "translate-x-8 bg-slate-800 text-slate-100"
                    : "translate-x-0 bg-white text-amber-500"
                }`}
              >
                {isDarkMode ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm10-7a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2ZM4 11a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h2Zm14.95-5.536a1 1 0 0 1 1.414 1.414l-1.415 1.414a1 1 0 1 1-1.414-1.414l1.415-1.414Zm-12.485 12.486a1 1 0 1 1 1.414 1.414L6.464 20.78a1 1 0 1 1-1.414-1.414l1.414-1.415Zm12.485 1.414a1 1 0 0 1-1.414 1.414l-1.415-1.415a1 1 0 0 1 1.414-1.414l1.415 1.415ZM7.879 6.879A1 1 0 1 1 6.465 8.293L5.05 6.88A1 1 0 0 1 6.464 5.464L7.88 6.88Z" />
                  </svg>
                )}
              </span>
              <span className={`ml-1 text-[10px] font-semibold ${isDarkMode ? "text-slate-500" : "text-amber-500"}`}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm10-7a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2h2ZM4 11a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2h2Zm14.95-5.536a1 1 0 0 1 1.414 1.414l-1.415 1.414a1 1 0 1 1-1.414-1.414l1.415-1.414Zm-12.485 12.486a1 1 0 1 1 1.414 1.414L6.464 20.78a1 1 0 1 1-1.414-1.414l1.414-1.415Zm12.485 1.414a1 1 0 0 1-1.414 1.414l-1.415-1.415a1 1 0 0 1 1.414-1.414l1.415 1.415ZM7.879 6.879A1 1 0 1 1 6.465 8.293L5.05 6.88A1 1 0 0 1 6.464 5.464L7.88 6.88Z" />
                </svg>
              </span>
              <span className={`ml-auto mr-1 text-[10px] font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-400"}`}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z" />
                </svg>
              </span>
            </span>
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {!cartItems || cartItems.length === 0 ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/20 px-6 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Todavia no hay productos en el carrito.
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Agrega productos desde el catalogo y podras cobrar desde aca mismo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.2rem] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-[13px] font-bold leading-tight text-slate-900 dark:text-slate-100">
                          {item.name}
                        </h3>
                        <p className="shrink-0 text-[13px] font-bold text-slate-900 dark:text-slate-100">
                          ${getLineTotal(item).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500">
                          ${item.price.toLocaleString("es-AR")}
                          {item.stockUnit === "kg"
                            ? " / kg"
                            : item.stockUnit === "liter"
                              ? " / l"
                              : " / unidad"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              item.id &&
                              handleUpdateQuantity(item.id, -(item.step ?? getQuantityStep(item.stockUnit)))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-600"
                          >
                            -
                          </button>
                          <span className="min-w-[5rem] rounded-full bg-white dark:bg-slate-800 px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {formatQuantity(item.quantity, item.stockUnit)}
                          </span>
                          <button
                            onClick={() =>
                              item.id &&
                              handleUpdateQuantity(item.id, item.step ?? getQuantityStep(item.stockUnit))
                            }
                            disabled={item.quantity >= item.stock}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-end">
                    <button
                      onClick={() => item.id && db.cart.delete(item.id)}
                      className="text-[11px] font-semibold text-red-500 transition-colors hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="rounded-[1.5rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
            <ClientSelector
              value={selectedClientId}
              onChange={setSelectedClientId}
              compact
            />
            <div className="mt-5 flex items-end justify-between gap-3">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Total a cobrar</span>
              <span className="text-3xl font-black text-slate-900 dark:text-slate-50">
                ${total.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                onClick={() => setIsPaymentDialogOpen(true)}
                disabled={!cartItems || cartItems.length === 0}
                className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                Cobrar
              </button>
              <button
                onClick={handleClearCart}
                disabled={!cartItems || cartItems.length === 0}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vaciar carrito
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ReceiptPrint
        order={printingOrder}
        onReadyToPrint={() => {
          if (!isPrintQueued) {
            return;
          }

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              window.print();
            });
          });
        }}
      />

      <PaymentMethodDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSelect={(paymentMethod) => void handleCheckout(paymentMethod)}
      />
    </>
  );
}
