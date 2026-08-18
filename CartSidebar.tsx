"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Order, type SessionUser } from "./db";
import { ClientSelector } from "./ClientSelector";
import { finalizeLocalOrder } from "./checkoutUtils";
import { PaymentMethodDialog } from "./PaymentMethodDialog";
import { formatQuantity, getLineTotal, getQuantityStep, getStockUnitLabel, roundQuantity } from "./saleUtils";
import { showToast } from "./Toast";

interface CartSidebarProps {
  currentUser: SessionUser | null;
  stockControlEnabled?: boolean;
  isDarkMode: boolean;
  isKioskMode: boolean;
  showWideLayout: boolean;
  onToggleTheme: () => void;
}

export function CartSidebar({
  currentUser,
  stockControlEnabled = true,
  isDarkMode,
  isKioskMode,
  showWideLayout,
  onToggleTheme,
}: CartSidebarProps) {
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const checkoutInProgressRef = useRef(false);
  const activeShift = useLiveQuery(async () => {
    if (!currentUser) {
      return undefined;
    }

    const openShifts = await db.shifts.where("status").equals("open").toArray();

    return openShifts
      .filter((shift) => {
        if (currentUser.id === null) {
          return !shift.openedByUserId;
        }

        return shift.openedByUserId === currentUser.id;
      })
      .sort((a, b) => b.openedAt - a.openedAt)[0];
  }, [currentUser?.id]);

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
  const hasOpenShift = Boolean(activeShift);

  const handleUpdateQuantity = async (id: number, delta: number) => {
    const item = await db.cart.get(id);
    if (!item) {
      return;
    }

    if (stockControlEnabled && delta > 0) {
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
    if (!cartItems || cartItems.length === 0 || checkoutInProgressRef.current) {
      return;
    }

    if (!hasOpenShift) {
      setIsPaymentDialogOpen(false);
      showToast("Abri un turno antes de cobrar.", "error");
      return;
    }

    try {
      checkoutInProgressRef.current = true;
      setIsCheckoutProcessing(true);
      await finalizeLocalOrder({
        cartItems,
        total,
        paymentMethod: paymentMethod ?? "cash",
        clientId: selectedClientId,
        generatePdf: false,
      });

      setIsPaymentDialogOpen(false);
      setSelectedClientId(null);
      showToast("Venta procesada con exito.", "success");
    } catch (error) {
      console.error("Error al finalizar el pedido:", error);
      showToast("No se pudo procesar la venta. Verifica el stock o la conexion.", "error");
    } finally {
      checkoutInProgressRef.current = false;
      setIsCheckoutProcessing(false);
    }
  };

  const openCheckoutFlow = useCallback(() => {
    if (!cartItems?.length || !hasOpenShift) {
      return;
    }

    setIsPaymentDialogOpen(true);
  }, [cartItems, hasOpenShift]);

  useEffect(() => {
    const handleKeyboardCheckout = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        isPaymentDialogOpen ||
        !cartItems?.length ||
        !hasOpenShift
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.matches("input, textarea, select, button, a") ||
        document.querySelector('[role="dialog"], .fixed.inset-0')
      ) {
        return;
      }

      event.preventDefault();
      openCheckoutFlow();
    };

    window.addEventListener("keydown", handleKeyboardCheckout);
    return () => window.removeEventListener("keydown", handleKeyboardCheckout);
  }, [cartItems, hasOpenShift, isPaymentDialogOpen, openCheckoutFlow]);

  return (
    <>
      <aside
        className={`hidden min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 print:hidden ${
          showWideLayout ? "lg:flex lg:h-full lg:p-2.5 xl:p-3" : "xl:flex xl:h-full xl:p-4"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div>
            <h2 className={`font-black text-slate-900 dark:text-slate-100 ${isKioskMode ? "text-[1.55rem]" : "text-2xl"}`}>
              {cartItems?.length || 0} producto{(cartItems?.length || 0) === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className={`touch-target flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 ${
              isKioskMode ? "py-2 text-sm" : "py-2 text-sm"
            } font-medium text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50`}
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

        <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${isKioskMode ? "mt-2" : "mt-3"}`}>
          {!cartItems || cartItems.length === 0 ? (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white px-4 text-center dark:border-slate-700 dark:bg-slate-800/20">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Todavia no hay productos en el carrito.
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Agrega productos desde el catalogo y podras cobrar desde aca mismo.
              </p>
            </div>
          ) : (
            <div className={`${isKioskMode ? "space-y-1.5" : "space-y-2"}`}>
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[1.2rem] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40 ${
                    isKioskMode ? "px-3 py-3" : "px-2.5 py-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`truncate font-bold leading-tight text-slate-900 dark:text-slate-100 ${isKioskMode ? "text-[15px]" : "text-[13px]"}`}>
                          {item.name}
                        </h3>
                        <p className={`shrink-0 font-bold text-slate-900 dark:text-slate-100 ${isKioskMode ? "text-[15px]" : "text-[13px]"}`}>
                          ${getLineTotal(item).toLocaleString("es-AR")}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className={`text-slate-500 ${isKioskMode ? "text-xs" : "text-[11px]"}`}>
                          ${item.price.toLocaleString("es-AR")}
                          {item.saleType === "variable"
                            ? ` · ${getStockUnitLabel(item.stockUnit)}`
                            : item.stockUnit === "kg"
                            ? " / kg"
                            : item.stockUnit === "liter"
                              ? " / l"
                              : " / unidad"}
                        </p>
                        {item.saleType === "variable" ? (
                          <span className={`rounded-full bg-blue-50 px-3 font-semibold text-blue-700 ${isKioskMode ? "py-2 text-xs" : "py-1.5 text-[11px]"}`}>
                            {getStockUnitLabel(item.stockUnit)} · importe libre
                          </span>
                        ) : <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              item.id &&
                              handleUpdateQuantity(item.id, -(item.step ?? getQuantityStep(item.stockUnit)))
                            }
                            className={`flex items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${
                              isKioskMode ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"
                            }`}
                          >
                            -
                          </button>
                          <span
                            className={`min-w-[5rem] rounded-full bg-white px-2.5 text-center font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${
                              isKioskMode ? "py-2 text-xs" : "py-1.5 text-[11px]"
                            }`}
                          >
                            {formatQuantity(item.quantity, item.stockUnit)}
                          </span>
                          <button
                            onClick={() =>
                              item.id &&
                              handleUpdateQuantity(item.id, item.step ?? getQuantityStep(item.stockUnit))
                            }
                            disabled={stockControlEnabled && item.quantity >= item.stock}
                            className={`flex items-center justify-center rounded-full border border-slate-200 bg-white font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${
                              isKioskMode ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"
                            }`}
                          >
                            +
                          </button>
                        </div>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-end">
                    <button
                      onClick={() => item.id && db.cart.delete(item.id)}
                      className={`font-semibold text-red-500 transition-colors hover:text-red-600 ${isKioskMode ? "text-xs" : "text-[11px]"}`}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`border-t border-slate-100 dark:border-slate-800 ${isKioskMode ? "mt-2 pt-2" : "mt-3 pt-3"}`}>
          <div
            className={`rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-800 ${
              isKioskMode ? "px-3 py-2.5" : "px-4 py-3"
            }`}
          >
            <ClientSelector
              value={selectedClientId}
              onChange={setSelectedClientId}
              compact
            />
            {!hasOpenShift && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                Abri un turno desde el menu para habilitar el cobro.
              </p>
            )}
            <div
              className={`flex items-end justify-between gap-3 ${
                isKioskMode ? "mt-2" : "mt-3"
              }`}
            >
              <span className={`${isKioskMode ? "text-xs" : "text-sm"} font-medium text-slate-500 dark:text-slate-400`}>
                Total a cobrar
              </span>
              <span className={`${isKioskMode ? "text-[1.8rem]" : "text-3xl"} font-black text-slate-900 dark:text-slate-50`}>
                ${total.toLocaleString("es-AR")}
              </span>
            </div>
            <div className={`grid ${isKioskMode ? "mt-3 gap-1.5" : "mt-4 gap-2"}`}>
              <button
                onClick={openCheckoutFlow}
                disabled={!cartItems || cartItems.length === 0 || !hasOpenShift}
                className={`touch-target w-full rounded-2xl bg-blue-500 px-4 font-semibold text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700 ${
                  isKioskMode ? "py-3 text-base" : "py-3 text-sm"
                }`}
              >
                {hasOpenShift ? "Cobrar (Enter)" : "Abrir turno para cobrar"}
              </button>
              <button
                onClick={handleClearCart}
                disabled={!cartItems || cartItems.length === 0}
                className={`w-full rounded-2xl border border-slate-200 px-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 ${
                  isKioskMode ? "py-2 text-xs" : "py-2 text-xs"
                }`}
              >
                Vaciar carrito
              </button>
            </div>
          </div>
        </div>
      </aside>

      <PaymentMethodDialog
        isOpen={isPaymentDialogOpen}
        isProcessing={isCheckoutProcessing}
        onClose={() => {
          if (!isCheckoutProcessing) {
            setIsPaymentDialogOpen(false);
          }
        }}
        onSelect={(paymentMethod) => void handleCheckout(paymentMethod)}
      />
    </>
  );
}
