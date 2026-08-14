"use client";

import { db } from "../../db";
import type {
  AppUser,
  AppUserInput,
  AppUserUpdateInput,
  CheckoutPayload,
  CheckoutResult,
  ClientInput,
  ClientRecord,
  LocalCreateInput,
  LocalRecord,
  LocalUpdateInput,
  PdfGenerationResult,
  Product,
  ProductInput,
  RemoteSnapshot,
  SalesResetInput,
  SalesResetResult,
  Shift,
  ShiftCloseInput,
  ShiftOpenInput,
  TicketEmailPayload,
  TicketEmailResult,
} from "./pos-types";
import { hydrateRemoteSnapshot } from "./remote-cache";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { data?: T; error?: string; details?: string }
    | null;

  if (!response.ok) {
    const message = payload?.error ?? "La solicitud fallo.";
    throw new ApiRequestError(
      payload?.details ? `${message} ${payload.details}` : message,
      response.status,
    );
  }

  if (!payload?.data) {
    throw new Error("La API no devolvio datos.");
  }

  return payload.data;
}

async function apiFetch<T>(input: RequestInfo, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    return readJson<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La solicitud tardo demasiado. Intenta nuevamente.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
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

  let cachedProduct = saved;

  if (saved.id && product.localStocks && product.localStocks.length > 0) {
    const knownLocales = await db.locals.toArray();
    const localNamesById = new Map(knownLocales.map((locale) => [locale.id, locale.name]));
    const normalizedLocalStocks = product.localStocks.map((localStock) => ({
      localId: localStock.localId,
      localName: localNamesById.get(localStock.localId),
      stock: localStock.stock,
      lowStockAlertThreshold: localStock.lowStockAlertThreshold,
    }));
    const preferredLocalStock =
      normalizedLocalStocks.find((localStock) => localStock.localId === product.preferredLocalId) ??
      normalizedLocalStocks[0];
    const globalStock = normalizedLocalStocks.reduce((acc, localStock) => acc + localStock.stock, 0);
    const globalLowStockAlertThreshold = normalizedLocalStocks.reduce(
      (acc, localStock) => acc + localStock.lowStockAlertThreshold,
      0,
    );

    cachedProduct = {
      ...saved,
      stock: preferredLocalStock?.stock ?? saved.stock,
      globalStock,
      lowStockAlertThreshold:
        preferredLocalStock?.lowStockAlertThreshold ?? saved.lowStockAlertThreshold,
      globalLowStockAlertThreshold,
      localStocks: normalizedLocalStocks,
    };
  }

  await db.products.put(cachedProduct);
  return cachedProduct;
}

export async function deleteProductRemote(productId: number) {
  await apiFetch<{ success: true }>(`/api/products/${productId}`, {
    method: "DELETE",
  });
  await db.products.delete(productId);
  await db.cart.where("productId").equals(productId).delete();
}

export async function moveProductCategoryRemote(sourceCategory: string, targetCategory: string) {
  const result = await apiFetch<{ updatedCount: number }>(
    `/api/product-categories/${encodeURIComponent(sourceCategory)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ targetCategory }),
    },
  );
  await syncRemoteSnapshot();
  return result;
}

export async function deleteProductCategoryRemote(category: string) {
  const result = await apiFetch<{ deletedCount: number }>(
    `/api/product-categories/${encodeURIComponent(category)}`,
    { method: "DELETE" },
  );
  await syncRemoteSnapshot();
  return result;
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

export async function createClientRemote(payload: ClientInput) {
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
  payload: ClientInput,
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

export async function resetSalesRemote(payload: SalesResetInput) {
  const result = await apiFetch<SalesResetResult>("/api/sales/reset", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await syncRemoteSnapshot();
  return result;
}

export async function sendTicketEmailRemote(payload: TicketEmailPayload) {
  return apiFetch<TicketEmailResult>("/api/tickets/email", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listAppUsersRemote() {
  return apiFetch<AppUser[]>("/api/users", {
    cache: "no-store",
  });
}

export async function createLocalRemote(payload: LocalCreateInput) {
  const local = await apiFetch<LocalRecord>("/api/locales", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await db.locals.put(local);
  return local;
}

export async function updateLocalRemote(localId: number, payload: LocalUpdateInput) {
  const local = await apiFetch<LocalRecord>(`/api/locales/${localId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  await syncRemoteSnapshot();
  return local;
}

export async function deleteLocalRemote(localId: number) {
  await apiFetch<{ success: true }>(`/api/locales/${localId}`, {
    method: "DELETE",
  });

  await syncRemoteSnapshot();
}

export async function createAppUserRemote(payload: AppUserInput) {
  return apiFetch<AppUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAppUserRemote(userId: number, payload: AppUserUpdateInput) {
  return apiFetch<AppUser>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAppUserRemote(userId: number) {
  return apiFetch<{ success: true }>(`/api/users/${userId}`, {
    method: "DELETE",
  });
}
