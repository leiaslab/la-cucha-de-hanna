"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Order, type SessionUser } from "./db";
import { ClientSelector } from "./ClientSelector";
import { finalizeLocalOrder } from "./checkoutUtils";
import { PaymentMethodDialog, getPaymentMethodLabel } from "./PaymentMethodDialog";
import { ReceiptPrint } from "./ReceiptPrint";
import { formatQuantity, getLineTotal, getQuantityStep, roundQuantity } from "./saleUtils";
import { showToast } from "./Toast";
import { useReceiptPrinting } from "./useReceiptPrinting";

interface CartModalProps {
  currentUser: SessionUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CartModal({ currentUser, isOpen, onClose }: CartModalProps) {
  const [activeTab, setActiveTab] = useState<"cart" | "orders">("cart");
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { printingOrder, queuePrint, handleReceiptReady } = useReceiptPrinting();
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
    const products = await db.products.where("id").anyOf(productIds).toArray();
    return items.map((item) => ({
      ...item,
      stock: products.find((product) => product.id === item.productId)?.stock ?? 0,
      category: products.find((product) => product.id === item.productId)?.category ?? "Varios",
      saleType:
        item.saleType ??
        products.find((product) => product.id === item.productId)?.saleType ??
        "fixed",
      stockUnit:
        item.stockUnit ??
        products.find((product) => product.id === item.productId)?.stockUnit ??
        "unit",
      step:
        item.step ??
        getQuantityStep(
          products.find((product) => product.id === item.productId)?.stockUnit ?? "unit",
        ),
    }));
  });

  const totalOrdersCount = useLiveQuery(() => db.orders.count()) || 0;

  const recentOrders = useLiveQuery(async () => {
    if (!selectedDate) {
      return db.orders.orderBy("createdAt").reverse().toArray();
    }

    const [y, m, d] = selectedDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();

    return db.orders
      .where("createdAt")
      .between(start, end, true, true)
      .reverse()
      .toArray();
  }, [selectedDate]);

  if (!isOpen) {
    return null;
  }

  const total = cartItems?.reduce((acc, item) => acc + getLineTotal(item), 0) || 0;
  const hasOpenShift = Boolean(activeShift);

  const handleUpdateQuantity = async (id: number, delta: number) => {
    const item = await db.cart.get(id);
    if (!item) {
      return;
    }

    if (delta > 0) {
      const product = await db.products.get(item.productId);
      if (product && item.quantity + delta > product.stock) {
        showToast(`No puedes agregar mas de "${item.name}". El stock actual es ${product.stock}.`, "error");
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

  const handleCheckout = async (paymentMethod: Order["paymentMethod"]) => {
    if (!cartItems || cartItems.length === 0) {
      return;
    }

    if (!hasOpenShift) {
      setIsPaymentDialogOpen(false);
      showToast("Abri un turno antes de cobrar.", "error");
      return;
    }

    try {
      const result = await finalizeLocalOrder({
        cartItems,
        total,
        notes,
        paymentMethod: paymentMethod ?? "cash",
        clientId: selectedClientId,
      });

      setNotes("");
      setSelectedClientId(null);
      setIsPaymentDialogOpen(false);
      showToast("Venta procesada con exito", "success");
      setActiveTab("orders");

      if (result.order) {
        queuePrint(result.order);
      }
    } catch (error) {
      console.error("Error al finalizar el pedido:", error);
      showToast("No se pudo procesar la venta. Verifica el stock o la conexion.", "error");
    }
  };

  const handlePrint = (order: Order) => {
    queuePrint(order);
  };

  const handleClearCart = async () => {
    if (confirm("Estas seguro de que deseas vaciar el carrito?")) {
      await db.cart.clear();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm print:hidden">
      <div className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="mb-4 flex items-center justify-between print:hidden border-b border-slate-50 dark:border-slate-800 pb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("cart")}
              className={`text-lg font-bold transition-colors ${
                activeTab === "cart" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-400"
              }`}
            >
              Carrito
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`text-lg font-bold transition-colors ${
                activeTab === "orders"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-400"
              }`}
            >
              Ventas ({totalOrdersCount})
            </button>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-500 hover:text-gray-700">
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 print:hidden">
          {activeTab === "cart" ? (
            <>
              <div className="space-y-4">
                {cartItems?.length === 0 ? (
                  <p className="py-10 text-center text-gray-500">Tu carrito esta vacio.</p>
                ) : (
                  cartItems?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
                    >
                      <div>
                        <h4 className="font-bold">{item.name}</h4>
                        <p className="text-sm text-gray-500">
                          ${item.price.toLocaleString()}{" "}
                          {item.stockUnit === "kg"
                            ? "/ kg"
                            : item.stockUnit === "liter"
                              ? "/ l"
                              : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            item.id &&
                            handleUpdateQuantity(
                              item.id,
                              -(item.step ?? getQuantityStep(item.stockUnit)),
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm"
                        >
                          -
                        </button>
                        <span className="min-w-16 text-center text-sm font-medium">
                          {formatQuantity(item.quantity, item.stockUnit)}
                        </span>
                        <button
                          onClick={() =>
                            item.id &&
                            handleUpdateQuantity(
                              item.id,
                              item.step ?? getQuantityStep(item.stockUnit),
                            )
                          }
                          disabled={item.quantity >= item.stock}
                          className="flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {cartItems && cartItems.length > 0 && (
                <div className="mt-4">
                  <ClientSelector
                    value={selectedClientId}
                    onChange={setSelectedClientId}
                  />
                  {!hasOpenShift && (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      Abri un turno para habilitar el cobro.
                    </p>
                  )}
                  <label
                    htmlFor="order-notes"
                    className="mb-1 mt-4 block text-sm font-medium text-gray-700"
                  >
                    Notas del pedido (opcional)
                  </label>
                  <textarea
                    id="order-notes"
                    className="w-full rounded-xl border bg-gray-50 p-3 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: entrega urgente, cliente paga con tarjeta..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <label htmlFor="date-filter" className="text-sm font-medium text-gray-600">
                  Filtrar por fecha:
                </label>
                <input
                  type="date"
                  id="date-filter"
                  className="rounded-lg border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate("")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {recentOrders === undefined ? (
                <p className="py-10 text-center text-gray-500">Cargando ventas...</p>
              ) : recentOrders.length === 0 ? (
                <p className="py-10 text-center text-gray-500">
                  {selectedDate
                    ? "No hay ventas para esta fecha."
                    : "Todavia no hay ventas registradas."}
                </p>
              ) : (
                recentOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="mb-2 flex justify-between">
                      <span className="text-xs font-bold uppercase tracking-tighter text-amber-700">
                        {order.status === "pending" ? "Pendiente de sincronizar" : "Guardada en Supabase"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="text-gray-700">
                          * {formatQuantity(item.quantity, item.stockUnit)} {item.name}
                        </li>
                      ))}
                    </ul>
                    {order.paymentMethod && (
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                        Pago: {getPaymentMethodLabel(order.paymentMethod)}
                      </p>
                    )}
                    {order.notes && (
                      <div className="mt-2 rounded-lg border-l-2 border-amber-300 bg-white/50 p-2 text-xs italic text-gray-600">
                        &quot;{order.notes}&quot;
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-amber-200 pt-2">
                      <button
                        onClick={() => handlePrint(order)}
                        className="flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
                      >
                        Imprimir Recibo
                      </button>
                      <div className="text-lg font-bold">Total: ${order.total.toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {activeTab === "cart" && cartItems && cartItems.length > 0 && !printingOrder && (
          <div className="mt-6 border-t pt-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="text-2xl font-extrabold">${total.toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClearCart}
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3 font-bold text-gray-600 transition-all active:scale-95 hover:bg-gray-100"
              >
                Vaciar
              </button>
              <button
                onClick={() => setIsPaymentDialogOpen(true)}
                disabled={!hasOpenShift}
                className="flex-[3] rounded-xl bg-green-600 py-3 font-bold text-white shadow-md transition-all active:scale-95 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {hasOpenShift ? "Cobrar" : "Abrir turno"}
              </button>
            </div>
          </div>
        )}

        <ReceiptPrint
          order={printingOrder}
          onReadyToPrint={() => {
            void handleReceiptReady();
          }}
        />
      </div>

      <PaymentMethodDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        onSelect={(paymentMethod) => void handleCheckout(paymentMethod)}
      />
    </div>
  );
}
