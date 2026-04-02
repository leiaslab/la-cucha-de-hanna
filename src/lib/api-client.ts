"use client";

import { db } from "../../db";
import type {
  CheckoutPayload,
  CheckoutResult,
  ClientRecord,
  PdfGenerationResult,
  Product,
  ProductInput,
  RemoteSnapshot,
  Shift,
  ShiftCloseInput,
  ShiftOpenInput,
} from "./pos-types";
import { hydrateRemoteSnapshot } from "./remote-cache";

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: string; details?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "La solicitud fallo.");
  }

  if (!payload?.data) {
    throw new Error("La API no devolvio datos.");
  }

  return payload.data;
}

async function apiFetch<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  return readJson<T>(response);
}

export async function syncRemoteSnapshot() {
  const snapshot = await apiFetch<RemoteSnapshot>("/api/bootstrap", {
    cache: "no-store",
  });
  await hydrateRemoteSnapshot(snapshot);
  return snapshot;
}

export async function saveProductRemote(product: ProductInput, productId?: number) {
  const saved = productId
    ? await apiFetch<Product>(`/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(product),
      })
    : await apiFetch<Product>("/api/products", {
        method: "POST",
        body: JSON.stringify(product),
      });

  await db.products.put(saved);
  return saved;
}

export async function deleteProductRemote(productId: number) {
  await apiFetch<{ success: true }>(`/api/products/${productId}`, {
    method: "DELETE",
  });
  await db.products.delete(productId);
  await db.cart.where("productId").equals(productId).delete();
}

export async function importProductsRemote(products: ProductInput[]) {
  const saved = await apiFetch<Product[]>("/api/products", {
    method: "PUT",
    body: JSON.stringify({ products }),
  });

  await db.transaction("rw", [db.products, db.cart], async () => {
    await db.products.clear();
    if (saved.length > 0) {
      await db.products.bulkPut(saved);
    }
    await db.cart.clear();
  });

  return saved;
}

export async function checkoutRemote(payload: CheckoutPayload) {
  const result = await apiFetch<CheckoutResult>("/api/sales/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await db.transaction("rw", [db.products, db.orders, db.cart, db.shifts], async () => {
    if (result.updatedProducts.length > 0) {
      await db.products.bulkPut(result.updatedProducts);
    }
    await db.orders.put(result.order);
    if (result.shift?.id) {
      await db.shifts.put(result.shift);
    }
    await db.cart.clear();
  });

  return result;
}

export async function openShiftRemote(payload: ShiftOpenInput) {
  const shift = await apiFetch<Shift>("/api/shifts/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await db.shifts.put(shift);
  return shift;
}

export async function closeShiftRemote(shiftId: number, payload: ShiftCloseInput) {
  const result = await apiFetch<{ shift: Shift; pdf: PdfGenerationResult | null }>(
    `/api/shifts/${shiftId}/close`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  await db.shifts.put(result.shift);
  return result;
}

export async function createClientRemote(payload: Omit<ClientRecord, "id" | "createdAt" | "updatedAt">) {
  return apiFetch<ClientRecord>("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listClientsRemote() {
  return apiFetch<ClientRecord[]>("/api/clients", {
    cache: "no-store",
  });
}

export async function updateClientRemote(
  clientId: number,
  payload: Omit<ClientRecord, "id" | "createdAt" | "updatedAt">,
) {
  return apiFetch<ClientRecord>(`/api/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteClientRemote(clientId: number) {
  return apiFetch<{ success: true }>(`/api/clients/${clientId}`, {
    method: "DELETE",
  });
}

export async function regenerateSalePdf(orderId: number) {
  return apiFetch<PdfGenerationResult>(`/api/pdfs/sales/${orderId}`, {
    method: "POST",
  });
}

export async function regenerateShiftPdf(shiftId: number) {
  return apiFetch<PdfGenerationResult>(`/api/pdfs/arqueos/${shiftId}`, {
    method: "POST",
  });
}
