"use client";

import { useEffect, useState } from "react";
import {
  getQzDiagnostics,
  type ThermalPaperWidth,
  type ThermalPrinterSettings,
  listThermalPrinters,
  loadThermalPrinterSettings,
  printThermalTestTicket,
  saveThermalPrinterSettings,
} from "./src/lib/thermal-print";
import { showToast } from "./Toast";

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultSettings = loadThermalPrinterSettings();

export function ThermalPrinterModal({ isOpen, onClose }: ThermalPrinterModalProps) {
  const [draft, setDraft] = useState<ThermalPrinterSettings>(defaultSettings);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCheckingQz, setIsCheckingQz] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [diagnosticMessage, setDiagnosticMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDraft(loadThermalPrinterSettings());
    setStatusMessage(null);
    setDiagnosticMessage(null);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const updateDraft = <K extends keyof ThermalPrinterSettings>(
    key: K,
    value: ThermalPrinterSettings[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleDetectPrinters = async () => {
    setIsDetecting(true);
    setStatusMessage(null);

    try {
      const printers = await listThermalPrinters();
      setAvailablePrinters(printers);

      if (printers.length === 0) {
        setStatusMessage("QZ Tray respondio, pero no encontro impresoras disponibles.");
      } else {
        setStatusMessage(`Se encontraron ${printers.length} impresora(s) en esta PC.`);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo conectar con QZ Tray en esta computadora.";
      setStatusMessage(message);
      showToast("No se pudo detectar la impresora. Revisa QZ Tray.", "error");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSave = () => {
    saveThermalPrinterSettings(draft);
    showToast("Configuracion de impresora guardada en esta PC.", "success");
    onClose();
  };

  const handleDiagnostics = async () => {
    setIsCheckingQz(true);
    setDiagnosticMessage(null);

    try {
      const result = await getQzDiagnostics();
      const parts = [result.message];

      if (result.host && result.port) {
        parts.push(`Conexion: ${result.host}:${result.port}`);
      }

      if (result.mode !== "unknown") {
        parts.push(`Modo: ${result.mode === "secure" ? "seguro" : "inseguro"}`);
      }

      if (result.defaultPrinter) {
        parts.push(`Predeterminada: ${result.defaultPrinter}`);
      }

      setDiagnosticMessage(parts.join(" | "));

      if (!result.ok) {
        showToast("QZ Tray no respondio correctamente.", "error");
        return;
      }

      setAvailablePrinters(result.printers);
      if (result.printers.length > 0) {
        showToast("Diagnostico de QZ correcto.", "success");
      } else {
        showToast("QZ Tray conecto, pero Windows no devolvio impresoras.", "warning");
      }
    } finally {
      setIsCheckingQz(false);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);

    try {
      await printThermalTestTicket(draft);
      showToast("Ticket de prueba enviado a la impresora.", "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo imprimir el ticket de prueba.";
      showToast(message, "error");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm print:hidden">
      <div className="flex w-full max-w-2xl flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Impresora termica
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Esta configuracion se guarda solo en esta computadora. Para imprimir automatico
              necesitas QZ Tray abierto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-5">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateDraft("enabled", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Imprimir tickets automaticamente al cobrar
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Si falla la impresion termica, la app va a volver a la impresion comun.
              </p>
            </div>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="thermal-printer-name"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Nombre exacto de la impresora
              </label>
              <input
                id="thermal-printer-name"
                type="text"
                value={draft.printerName}
                onChange={(event) => updateDraft("printerName", event.target.value)}
                placeholder="Ej: EPSON TM-T20III Receipt"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/30"
              />
            </div>

            <div>
              <label
                htmlFor="thermal-paper-width"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Ancho del papel
              </label>
              <select
                id="thermal-paper-width"
                value={draft.paperWidth}
                onChange={(event) =>
                  updateDraft("paperWidth", event.target.value as ThermalPaperWidth)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/30"
              >
                <option value="58mm">58 mm</option>
                <option value="80mm">80 mm</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <input
              type="checkbox"
              checked={draft.autoCut}
              onChange={(event) => updateDraft("autoCut", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ejecutar corte automatico del ticket
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Usa el comando de corte ESC/POS al final de cada venta.
              </p>
            </div>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDetectPrinters()}
                disabled={isDetecting}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {isDetecting ? "Buscando..." : "Detectar impresoras"}
              </button>
              <button
                type="button"
                onClick={() => void handleDiagnostics()}
                disabled={isCheckingQz}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingQz ? "Revisando..." : "Diagnostico QZ"}
              </button>
              <button
                type="button"
                onClick={() => void handleTestPrint()}
                disabled={isTesting}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTesting ? "Imprimiendo..." : "Imprimir prueba"}
              </button>
            </div>

            {statusMessage && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{statusMessage}</p>
            )}

            {diagnosticMessage && (
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {diagnosticMessage}
              </p>
            )}

            {availablePrinters.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {availablePrinters.map((printerName) => (
                  <button
                    key={printerName}
                    type="button"
                    onClick={() => updateDraft("printerName", printerName)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      draft.printerName === printerName
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {printerName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
