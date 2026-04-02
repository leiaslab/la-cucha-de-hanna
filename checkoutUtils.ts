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
}: {
  cartItems: CheckoutItem[];
  total: number;
  notes?: string;
  paymentMethod: PaymentMethod;
  clientId?: number | null;
}) {
  const result = await checkoutRemote({
    cartItems,
    total,
    notes,
    paymentMethod,
    clientId,
    generatePdf: true,
  });

  if (result.pdf) {
    downloadPdfResult(result.pdf);
  }

  return result;
}
