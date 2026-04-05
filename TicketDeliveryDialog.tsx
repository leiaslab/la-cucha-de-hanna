"use client";

import { useMemo, useState } from "react";
import type { Order } from "./db";
import { sendTicketEmailRemote } from "./src/lib/api-client";
import type { PdfGenerationResult } from "./src/lib/pos-types";
import { showToast } from "./Toast";

interface TicketDeliveryDialogProps {
  isOpen: boolean;
  order: Order | null;
  pdf: PdfGenerationResult | null;
  onClose: () => void;
  onPrint: () => void;
}

export function TicketDeliveryDialog({
  isOpen,
  order,
  pdf,
  onClose,
  onPrint,
}: TicketDeliveryDialogProps) {
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const canSendMail = useMemo(() => email.trim().length > 0 && Boolean(order), [email, order]);

  if (!isOpen || !order) {
    return null;
  }

  const handleSendEmail = async () => {
    const recipient = email.trim();

    if (!recipient) {
      showToast("Ingresa un email para enviar el ticket.", "error");
      return;
    }

    try {
      setIsSendingEmail(true);
      await sendTicketEmailRemote({ email: recipient, order, pdf });
      showToast("Ticket enviado por mail.", "success");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo enviar el ticket por mail.";
      showToast(message, "error");
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 pb-4 text-center dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            Ticket
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
            Que queres hacer con el ticket?
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Venta #{order.id ?? "-"} por ${order.total.toLocaleString("es-AR")}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={onPrint}
            className="rounded-[1.5rem] border border-blue-200 bg-blue-50 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
          >
            <span className="block text-lg font-bold text-blue-700 dark:text-blue-300">Imprimir</span>
            <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Ticket fisico
            </span>
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
          >
            <span className="block text-lg font-bold text-emerald-700 dark:text-emerald-300">Mail</span>
            <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Envio directo desde la app
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <span className="block text-lg font-bold text-slate-700 dark:text-slate-200">Nada</span>
            <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Cerrar y seguir
            </span>
          </button>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <label htmlFor="ticket-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Email para el ticket
          </label>
          <input
            id="ticket-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSendingEmail}
            placeholder="cliente@email.com"
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            El ticket se envia desde la app y adjunta el PDF cuando esta disponible.
          </p>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={!canSendMail || isSendingEmail}
            className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSendingEmail ? "Enviando..." : "Enviar por mail"}
          </button>
        </div>
      </div>
    </div>
  );
}
