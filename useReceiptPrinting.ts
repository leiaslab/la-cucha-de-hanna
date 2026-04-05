"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Order, type SessionUser } from "./db";
import { printSaleReceipt } from "./src/lib/thermal-print";
import { showToast } from "./Toast";

export function useReceiptPrinting(currentUser: SessionUser | null) {
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isPrintQueued, setIsPrintQueued] = useState(false);
  const printingOrderRef = useRef<Order | null>(null);
  const isPrintQueuedRef = useRef(false);
  const currentLocal = useLiveQuery(
    () => (currentUser?.localId ? db.locals.get(currentUser.localId) : undefined),
    [currentUser?.localId],
  );

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

    if (currentUser?.localId && currentLocal?.thermalPrinterEnabled === false) {
      showToast("La impresion esta desactivada para este local.", "warning");
      resetPrintQueue();
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
  }, [currentLocal?.thermalPrinterEnabled, currentUser?.localId, resetPrintQueue, triggerBrowserPrint]);

  return {
    printingOrder,
    queuePrint,
    handleReceiptReady,
  };
}
