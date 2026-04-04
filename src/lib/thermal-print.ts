"use client";

import type { Order, PaymentMethod } from "./pos-types";

export type ThermalPaperWidth = "58mm" | "80mm";

export interface ThermalPrinterSettings {
  enabled: boolean;
  printerName: string;
  paperWidth: ThermalPaperWidth;
  autoCut: boolean;
}

export type AutomaticReceiptPrintResult =
  | {
      mode: "thermal";
      printerName: string;
    }
  | {
      mode: "browser";
      reason: "disabled" | "missing-printer" | "qz-unavailable" | "thermal-error";
      message?: string;
    };

const STORAGE_KEY = "thermal-printer-settings";

const DEFAULT_SETTINGS: ThermalPrinterSettings = {
  enabled: false,
  printerName: "",
  paperWidth: "80mm",
  autoCut: true,
};

type QzLike = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
  printers: {
    find: (query?: string) => Promise<string[] | string>;
  };
  configs: {
    create: (printerName: string, options?: Record<string, unknown>) => unknown;
  };
  print: (config: unknown, data: Array<string | Record<string, unknown>>) => Promise<void>;
  security: {
    setCertificatePromise: (
      handler: (() => Promise<string | null>) | (() => Promise<null>),
      options?: Record<string, unknown>,
    ) => void;
    setSignaturePromise: (handler: (dataToSign: string) => Promise<string | void>) => void;
  };
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeSettings(input: Partial<ThermalPrinterSettings> | null | undefined) {
  return {
    enabled: Boolean(input?.enabled),
    printerName: typeof input?.printerName === "string" ? input.printerName : "",
    paperWidth: input?.paperWidth === "58mm" ? "58mm" : "80mm",
    autoCut: input?.autoCut ?? true,
  } satisfies ThermalPrinterSettings;
}

function normalizeTicketText(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replaceAll("•", "-");
}

function formatCurrency(value: number) {
  const hasDecimals = Math.round(value * 100) % 100 !== 0;

  return value.toLocaleString("es-AR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number) {
  const hasDecimals = Math.round(value * 100) % 100 !== 0;

  return value.toLocaleString("es-AR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function getPaymentMethodLabel(paymentMethod?: PaymentMethod) {
  switch (paymentMethod) {
    case "mercado_pago":
      return "Mercado Pago";
    case "transfer":
      return "Transferencia";
    case "cash":
    default:
      return "Efectivo";
  }
}

function wrapLine(value: string, width: number) {
  const cleanValue = normalizeTicketText(value).trim();
  if (!cleanValue) {
    return [""];
  }

  const words = cleanValue.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > width) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function alignRight(value: string, width: number) {
  const cleanValue = normalizeTicketText(value);
  if (cleanValue.length >= width) {
    return cleanValue;
  }

  return `${" ".repeat(width - cleanValue.length)}${cleanValue}`;
}

function buildReceiptCommands(order: Order, settings: ThermalPrinterSettings) {
  const esc = "\x1B";
  const gs = "\x1D";
  const lineWidth = settings.paperWidth === "58mm" ? 32 : 48;
  const divider = "-".repeat(lineWidth);
  const createdAt = new Date(order.createdAt);
  const headerDate = createdAt.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const commands: string[] = [
    `${esc}@`,
    `${esc}a\x01`,
    `${esc}E\x01`,
    `${gs}!\x11`,
    "LA CUCHA DE HANNA\n",
    `${gs}!\x00`,
    `${esc}E\x00`,
  ];

  if (order.localName) {
    commands.push(`${normalizeTicketText(order.localName.toUpperCase())}\n`);
  }

  commands.push(`${headerDate}\n`);

  if (order.userFullName) {
    commands.push(`${normalizeTicketText(order.userFullName)}\n`);
  }

  commands.push(`${esc}a\x00`);
  commands.push(`${divider}\n`);

  order.items.forEach((item) => {
    const quantityLabel = `${formatQuantity(item.quantity)} ${
      item.stockUnit === "kg" ? "kg" : item.stockUnit === "liter" ? "l" : "un"
    }`;
    const itemTitle = `${quantityLabel} x ${item.name}`;

    wrapLine(itemTitle, lineWidth).forEach((line) => {
      commands.push(`${line}\n`);
    });

    commands.push(
      `${alignRight(`$${formatCurrency(item.price * item.quantity)}`, lineWidth)}\n`,
    );
  });

  commands.push(`${divider}\n`);
  commands.push(`${esc}E\x01`);
  commands.push(`${alignRight(`TOTAL $${formatCurrency(order.total)}`, lineWidth)}\n`);
  commands.push(`${esc}E\x00`);
  commands.push(`${alignRight(getPaymentMethodLabel(order.paymentMethod), lineWidth)}\n`);

  if (order.notes) {
    commands.push(`${divider}\n`);
    wrapLine(`Nota: ${order.notes}`, lineWidth).forEach((line) => {
      commands.push(`${line}\n`);
    });
  }

  commands.push(`${divider}\n`);
  commands.push(`${esc}a\x01`);
  commands.push("Gracias por tu compra\n");
  commands.push("\n\n\n");

  if (settings.autoCut) {
    commands.push(`${gs}V\x00`);
  }

  return commands;
}

async function getQzTray() {
  if (typeof window === "undefined") {
    throw new Error("La impresion termica solo esta disponible en el navegador.");
  }

  const qzModule = await import("qz-tray");
  const qz = (qzModule.default ?? qzModule) as QzLike;

  qz.security.setCertificatePromise(async () => null);
  qz.security.setSignaturePromise(async () => "");

  return qz;
}

async function withQzConnection<T>(task: (qz: QzLike) => Promise<T>) {
  const qz = await getQzTray();
  const shouldDisconnect = !qz.websocket.isActive();

  if (shouldDisconnect) {
    await qz.websocket.connect();
  }

  try {
    return await task(qz);
  } finally {
    if (shouldDisconnect && qz.websocket.isActive()) {
      try {
        await qz.websocket.disconnect();
      } catch {
        // Ignore disconnect errors so they don't mask the print result.
      }
    }
  }
}

export function loadThermalPrinterSettings() {
  if (!canUseStorage()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SETTINGS;
    }

    return normalizeSettings(JSON.parse(rawValue) as Partial<ThermalPrinterSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveThermalPrinterSettings(settings: ThermalPrinterSettings) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export async function listThermalPrinters() {
  const printers = await withQzConnection((qz) => qz.printers.find());
  if (Array.isArray(printers)) {
    return printers;
  }

  return printers ? [printers] : [];
}

export async function printThermalTestTicket(settings?: ThermalPrinterSettings) {
  const activeSettings = normalizeSettings(settings ?? loadThermalPrinterSettings());

  if (!activeSettings.printerName.trim()) {
    throw new Error("Elegi una impresora antes de imprimir una prueba.");
  }

  const sampleOrder: Order = {
    id: Date.now(),
    items: [
      {
        productId: 1,
        name: "Ticket de prueba",
        price: 1000,
        quantity: 1,
        category: "Prueba",
        saleType: "fixed",
        stockUnit: "unit",
        step: 1,
      },
    ],
    total: 1000,
    status: "synced",
    createdAt: Date.now(),
    paymentMethod: "cash",
    notes: "Prueba de impresora termica",
  };

  await withQzConnection(async (qz) => {
    const config = qz.configs.create(activeSettings.printerName.trim(), {
      copies: 1,
      encoding: "UTF-8",
      jobName: "Prueba de ticket",
    });

    await qz.print(config, buildReceiptCommands(sampleOrder, activeSettings));
  });
}

export async function printSaleReceipt(order: Order): Promise<AutomaticReceiptPrintResult> {
  const settings = loadThermalPrinterSettings();

  if (!settings.enabled) {
    return { mode: "browser", reason: "disabled" };
  }

  if (!settings.printerName.trim()) {
    return {
      mode: "browser",
      reason: "missing-printer",
      message: "No hay una impresora termica configurada en esta PC.",
    };
  }

  try {
    await withQzConnection(async (qz) => {
      const config = qz.configs.create(settings.printerName.trim(), {
        copies: 1,
        encoding: "UTF-8",
        jobName: `Ticket venta ${order.id ?? ""}`.trim(),
      });

      await qz.print(config, buildReceiptCommands(order, settings));
    });

    return {
      mode: "thermal",
      printerName: settings.printerName.trim(),
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo conectar con QZ Tray o con la impresora termica.";

    return {
      mode: "browser",
      reason: "thermal-error",
      message,
    };
  }
}
