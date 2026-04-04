"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Order } from "./db";
import { printSaleReceipt } from "./src/lib/thermal-print";
import { showToast } from "./Toast";

export function useReceiptPrinting() {
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isPrintQueued, setIsPrintQueued] = useState(false);
  const printingOrderRef = useRef<Order | null>(null);
  const isPrintQueuedRef = useRef(false);

  useEffect(() => {
    printingOrderRef.current = printingOrder;
  }, [printingOrder]);

  useEffect(() => {
    isPrintQueuedRef.current = isPrintQueued;
  }, [isPrintQueued]);

  const resetPrintQueue = useCallback(() => {
    setPrintingOrder(null);
    setIsPrintQueued(false);
  }, []);

  const triggerBrowserPrint = useCallback(() => {
    const handleAfterPrint = () => {
      resetPrintQueue();
      window.removeEventListener("afterprint", handleAfterPrint);
    };

    window.addEventListener("afterprint", handleAfterPrint);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [resetPrintQueue]);

  const queuePrint = useCallback((order: Order) => {
    setPrintingOrder(order);
    setIsPrintQueued(true);
  }, []);

  const handleReceiptReady = useCallback(async () => {
    if (!isPrintQueuedRef.current || !printingOrderRef.current) {
      return;
    }

    const result = await printSaleReceipt(printingOrderRef.current);

    if (result.mode === "thermal") {
      showToast(`Ticket enviado a ${result.printerName}.`, "success");
      resetPrintQueue();
      return;
    }

    if (result.reason !== "disabled" && result.message) {
      showToast(`${result.message} Se abrio la impresion comun.`, "warning");
    }

    triggerBrowserPrint();
  }, [resetPrintQueue, triggerBrowserPrint]);

  return {
    printingOrder,
    queuePrint,
    handleReceiptReady,
  };
}
