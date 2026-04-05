import type { CartItem, PaymentMethod } from "./db";
import { checkoutRemote } from "./src/lib/api-client";
import { downloadPdfResult } from "./src/lib/pdf-download";

type CheckoutItem = CartItem & {
  stock?: number;
};

export async function finalizeLocalOrder({
  cartItems,
  total,
  notes,
  paymentMethod,
  clientId,
  autoDownloadPdf = false,
  generatePdf = false,
}: {
  cartItems: CheckoutItem[];
  total: number;
  notes?: string;
  paymentMethod: PaymentMethod;
  clientId?: number | null;
  autoDownloadPdf?: boolean;
  generatePdf?: boolean;
}) {
  const result = await checkoutRemote({
    cartItems,
    total,
    notes,
    paymentMethod,
    clientId,
    generatePdf,
  });

  if (result.pdf && autoDownloadPdf) {
    downloadPdfResult(result.pdf);
  }

  return result;
}
