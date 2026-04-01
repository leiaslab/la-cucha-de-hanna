"use client";

import { createPortal } from "react-dom";
import { type Order } from "./db";
import { formatQuantity, getLineTotal } from "./saleUtils";

interface ReceiptPrintProps {
  order: Order | null;
}

export function ReceiptPrint({ order }: ReceiptPrintProps) {
  if (typeof document === "undefined" || !order) {
    return null;
  }

  return createPortal(
    <div className="receipt-print-root hidden bg-white px-4 py-5 text-black print:block">
      <div className="mx-auto w-full max-w-[360px]">
        <div className="mb-4 border-b border-black pb-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo La cucha de Hanna"
            className="mx-auto mb-2 h-16 w-16 object-contain"
          />
          <h1 className="text-xl font-bold uppercase tracking-tight">La cucha de Hanna</h1>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black text-[10px] uppercase">
              <th className="py-2">Cant.</th>
              <th className="py-2">Producto</th>
              <th className="py-2 text-right">Precio</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {order.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2">{formatQuantity(item.quantity, item.stockUnit)}</td>
                <td className="py-2 font-medium">{item.name}</td>
                <td className="py-2 text-right">${item.price.toLocaleString("es-AR")}</td>
                <td className="py-2 text-right">${getLineTotal(item).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 border-t border-black pt-3 text-right">
          <p className="text-[10px] uppercase text-gray-500">Total</p>
          <p className="text-3xl font-black">${order.total.toLocaleString("es-AR")}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
