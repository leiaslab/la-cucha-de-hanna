import "server-only";

import type { Order, PaymentMethod, PdfGenerationResult, TicketEmailPayload, TicketEmailResult } from "./pos-types";
import { getTicketEmailEnv } from "./server-env";

type ResendSendEmailResponse = {
  id?: string;
  message?: string;
  error?: string;
  name?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function getPaymentMethodLabel(paymentMethod: PaymentMethod | null | undefined) {
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildEmailSubject(order: Order) {
  return `Ticket de compra #${order.id ?? "-"} - La Cucha de Hanna`;
}

function buildEmailText(order: Order, pdf: PdfGenerationResult | null | undefined) {
  const lines = [
    "Hola,",
    "",
    "Te compartimos el ticket de tu compra en La Cucha de Hanna.",
    "",
    `Venta: #${order.id ?? "-"}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString("es-AR")}`,
    `Total: ${formatCurrency(order.total)}`,
    `Forma de pago: ${getPaymentMethodLabel(order.paymentMethod)}`,
  ];

  if (pdf?.record.driveUrl) {
    lines.push(`Ticket online: ${pdf.record.driveUrl}`);
  }

  lines.push("", "Gracias por tu compra.");
  return lines.join("\n");
}

function buildEmailHtml(order: Order, pdf: PdfGenerationResult | null | undefined) {
  const createdAt = new Date(order.createdAt).toLocaleString("es-AR");
  const paymentMethod = getPaymentMethodLabel(order.paymentMethod);
  const itemsHtml = order.items
    .map((item) => {
      const quantity = Number.isInteger(item.quantity)
        ? item.quantity.toString()
        : item.quantity.toLocaleString("es-AR");

      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:center;">${escapeHtml(quantity)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatCurrency(item.price))}</td>
        </tr>
      `;
    })
    .join("");

  const ticketLinkHtml = pdf?.record.driveUrl
    ? `
      <p style="margin:16px 0 0;font-size:14px;color:#475569;">
        Tambien podes ver tu ticket online en
        <a href="${escapeHtml(pdf.record.driveUrl)}" style="color:#2563eb;">este enlace</a>.
      </p>
    `
    : "";

  return `
    <div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#2563eb;">
          Ticket
        </p>
        <h1 style="margin:12px 0 8px;font-size:28px;line-height:1.1;">
          Gracias por tu compra
        </h1>
        <p style="margin:0;font-size:15px;color:#475569;">
          Venta #${escapeHtml(String(order.id ?? "-"))} realizada el ${escapeHtml(createdAt)}.
        </p>

        <div style="margin:20px 0;padding:16px;border-radius:18px;background:#eff6ff;">
          <p style="margin:0 0 8px;font-size:14px;color:#475569;">Forma de pago</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(paymentMethod)}</p>
          <p style="margin:14px 0 0;font-size:14px;color:#475569;">Total</p>
          <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:#0f172a;">${escapeHtml(formatCurrency(order.total))}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr>
              <th style="padding:0 0 10px;text-align:left;color:#64748b;">Producto</th>
              <th style="padding:0 0 10px;text-align:center;color:#64748b;">Cant.</th>
              <th style="padding:0 0 10px;text-align:right;color:#64748b;">Precio</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        ${ticketLinkHtml}

        <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
          Si recibiste este mail por error, podes ignorarlo.
        </p>
      </div>
    </div>
  `;
}

export async function sendTicketEmail(payload: TicketEmailPayload): Promise<TicketEmailResult> {
  const recipient = payload.email.trim().toLowerCase();

  if (!recipient) {
    throw new Error("Ingresa un email para enviar el ticket.");
  }

  if (!isValidEmail(recipient)) {
    throw new Error("Ingresa un email valido para enviar el ticket.");
  }

  if (!payload.order?.id) {
    throw new Error("No se encontro la venta a enviar.");
  }

  const { resendApiKey, mailFrom } = getTicketEmailEnv();

  if (!resendApiKey || !mailFrom) {
    throw new Error("Falta configurar RESEND_API_KEY y MAIL_FROM en el servidor.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mailFrom,
      to: [recipient],
      subject: buildEmailSubject(payload.order),
      html: buildEmailHtml(payload.order, payload.pdf),
      text: buildEmailText(payload.order, payload.pdf),
      attachments: payload.pdf
        ? [
            {
              filename: payload.pdf.record.fileName,
              content: payload.pdf.base64,
            },
          ]
        : undefined,
    }),
  });

  const responsePayload = (await response.json().catch(() => null)) as ResendSendEmailResponse | null;

  if (!response.ok) {
    throw new Error(
      responsePayload?.message ??
        responsePayload?.error ??
        responsePayload?.name ??
        "No se pudo enviar el ticket por mail.",
    );
  }

  if (!responsePayload?.id) {
    throw new Error("El servicio de mail no devolvio un identificador de envio.");
  }

  return { id: responsePayload.id };
}
