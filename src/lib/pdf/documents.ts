import "server-only";

import { PDFDocument, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Order, Shift } from "../pos-types";

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  font,
  size,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  size: number;
}) {
  const words = text.split(/\s+/);
  let currentLine = "";
  let cursorY = y;

  words.forEach((word) => {
    const maybeLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(maybeLine, size) <= maxWidth) {
      currentLine = maybeLine;
      return;
    }

    if (currentLine) {
      page.drawText(currentLine, { x, y: cursorY, size, font, color: rgb(0.15, 0.23, 0.34) });
      cursorY -= lineHeight;
    }

    currentLine = word;
  });

  if (currentLine) {
    page.drawText(currentLine, { x, y: cursorY, size, font, color: rgb(0.15, 0.23, 0.34) });
    cursorY -= lineHeight;
  }

  return cursorY;
}

export async function renderSalePdf(order: Order) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let cursorY = 790;

  page.drawText("PepShop POS", {
    x: margin,
    y: cursorY,
    size: 22,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  cursorY -= 24;

  page.drawText("Comprobante de venta", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontRegular,
    color: rgb(0.35, 0.42, 0.5),
  });
  cursorY -= 30;

  const metadataLines = [
    `Venta #${order.id ?? "-"}`,
    `Fecha: ${formatDateTime(order.createdAt)}`,
    `Forma de pago: ${order.paymentMethod ?? "Sin especificar"}`,
    `Estado: ${order.status}`,
  ];

  metadataLines.forEach((line) => {
    page.drawText(line, {
      x: margin,
      y: cursorY,
      size: 10,
      font: fontRegular,
      color: rgb(0.15, 0.23, 0.34),
    });
    cursorY -= 16;
  });

  if (order.notes) {
    cursorY -= 6;
    page.drawText("Notas", {
      x: margin,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: rgb(0.05, 0.12, 0.25),
    });
    cursorY -= 16;
    cursorY =
      drawWrappedText({
        page,
        text: order.notes,
        x: margin,
        y: cursorY,
        maxWidth: 500,
        lineHeight: 14,
        font: fontRegular,
        size: 10,
      }) ?? cursorY;
  }

  cursorY -= 12;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: 547, y: cursorY },
    thickness: 1,
    color: rgb(0.8, 0.84, 0.88),
  });
  cursorY -= 22;

  page.drawText("Detalle", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  cursorY -= 20;

  order.items.forEach((item) => {
    page.drawText(item.name, {
      x: margin,
      y: cursorY,
      size: 10,
      font: fontBold,
      color: rgb(0.15, 0.23, 0.34),
    });
    page.drawText(`${item.quantity.toLocaleString("es-AR")} x ${formatCurrency(item.price)}`, {
      x: margin,
      y: cursorY - 14,
      size: 9,
      font: fontRegular,
      color: rgb(0.35, 0.42, 0.5),
    });
    page.drawText(formatCurrency(item.price * item.quantity), {
      x: 460,
      y: cursorY - 7,
      size: 10,
      font: fontBold,
      color: rgb(0.05, 0.29, 0.67),
    });
    cursorY -= 34;
  });

  cursorY -= 8;
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: 547, y: cursorY },
    thickness: 1,
    color: rgb(0.8, 0.84, 0.88),
  });
  cursorY -= 28;

  page.drawText("Total", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  page.drawText(formatCurrency(order.total), {
    x: 420,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: rgb(0.05, 0.29, 0.67),
  });

  return pdf.save();
}

export async function renderShiftPdf({
  shift,
  orders,
}: {
  shift: Shift;
  orders: Order[];
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let cursorY = 790;

  page.drawText("PepShop POS", {
    x: margin,
    y: cursorY,
    size: 22,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  cursorY -= 24;

  page.drawText("Arqueo de caja", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontRegular,
    color: rgb(0.35, 0.42, 0.5),
  });
  cursorY -= 30;

  const summaryLines = [
    `Turno #${shift.id ?? "-"}`,
    `Estado: ${shift.status}`,
    `Apertura: ${formatDateTime(shift.openedAt)}`,
    `Cierre: ${shift.closedAt ? formatDateTime(shift.closedAt) : "Sin cierre"}`,
    `Caja inicial: ${formatCurrency(shift.openingCash)}`,
    `Caja esperada: ${formatCurrency(shift.expectedCash ?? shift.openingCash)}`,
    `Ventas: ${formatCurrency(shift.totalSales ?? 0)}`,
    `Pedidos: ${(shift.orderCount ?? orders.length).toLocaleString("es-AR")}`,
  ];

  summaryLines.forEach((line) => {
    page.drawText(line, {
      x: margin,
      y: cursorY,
      size: 10,
      font: fontRegular,
      color: rgb(0.15, 0.23, 0.34),
    });
    cursorY -= 16;
  });

  cursorY -= 10;
  page.drawText("Resumen por forma de pago", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  cursorY -= 20;

  [
    `Efectivo: ${formatCurrency(shift.cashSales ?? 0)}`,
    `Mercado Pago: ${formatCurrency(shift.mercadoPagoSales ?? 0)}`,
    `Transferencia: ${formatCurrency(shift.transferSales ?? 0)}`,
  ].forEach((line) => {
    page.drawText(line, {
      x: margin,
      y: cursorY,
      size: 10,
      font: fontRegular,
      color: rgb(0.15, 0.23, 0.34),
    });
    cursorY -= 16;
  });

  if (shift.openingNote) {
    cursorY -= 10;
    page.drawText("Nota de apertura", {
      x: margin,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: rgb(0.05, 0.12, 0.25),
    });
    cursorY -= 16;
    cursorY =
      drawWrappedText({
        page,
        text: shift.openingNote,
        x: margin,
        y: cursorY,
        maxWidth: 500,
        lineHeight: 14,
        font: fontRegular,
        size: 10,
      }) ?? cursorY;
  }

  if (shift.closingNote) {
    cursorY -= 10;
    page.drawText("Nota de cierre", {
      x: margin,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: rgb(0.05, 0.12, 0.25),
    });
    cursorY -= 16;
    cursorY =
      drawWrappedText({
        page,
        text: shift.closingNote,
        x: margin,
        y: cursorY,
        maxWidth: 500,
        lineHeight: 14,
        font: fontRegular,
        size: 10,
      }) ?? cursorY;
  }

  cursorY -= 10;
  page.drawText("Ultimas ventas del turno", {
    x: margin,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: rgb(0.05, 0.12, 0.25),
  });
  cursorY -= 20;

  orders.slice(0, 12).forEach((order) => {
    page.drawText(`#${order.id ?? "-"} ${formatDateTime(order.createdAt)}`, {
      x: margin,
      y: cursorY,
      size: 9,
      font: fontBold,
      color: rgb(0.15, 0.23, 0.34),
    });
    page.drawText(formatCurrency(order.total), {
      x: 460,
      y: cursorY,
      size: 9,
      font: fontBold,
      color: rgb(0.05, 0.29, 0.67),
    });
    cursorY -= 13;
  });

  return pdf.save();
}
