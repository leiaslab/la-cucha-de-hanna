import "server-only";

import type {
  CheckoutPayload,
  CheckoutResult,
  ClientRecord,
  SessionUser,
  Order,
  PaymentMethod,
  PdfGenerationResult,
  PdfRecord,
  Product,
  ProductInput,
  RemoteSnapshot,
  Shift,
  ShiftCloseInput,
  ShiftOpenInput,
} from "./pos-types";
import { uploadPdfToDrive } from "./google/drive";
import { renderSalePdf, renderShiftPdf } from "./pdf/documents";
import { createServiceRoleSupabaseClient } from "./supabase/server";

type ProductRow = {
  id: number;
  name: string;
  price: number;
  cost: number;
  stock: number;
  low_stock_alert_threshold: number;
  category: string;
  slug: string;
  sale_type: Product["saleType"];
  stock_unit: Product["stockUnit"];
  description: string | null;
  image_url: string | null;
  last_updated: string;
};

type SaleDetailRow = {
  id: number;
  sale_id: number;
  product_id: number | null;
  name: string;
  price: number;
  quantity: number;
  category: string;
  sale_type: Product["saleType"];
  stock_unit: Product["stockUnit"];
  step: number;
};

type SaleRow = {
  id: number;
  total: number;
  status: Order["status"];
  created_at: string;
  notes: string | null;
  payment_method: PaymentMethod | null;
  shift_id: number | null;
  client_id: number | null;
  user_id: number | null;
  detalle_ventas?: SaleDetailRow[] | null;
};

type ShiftRow = {
  id: number;
  status: Shift["status"];
  opened_at: string;
  opening_cash: number;
  opened_by_user_id: number | null;
  opening_note: string | null;
  closed_at: string | null;
  closed_by_user_id: number | null;
  closing_note: string | null;
  order_count: number | null;
  total_sales: number | null;
  cash_sales: number | null;
  mercado_pago_sales: number | null;
  transfer_sales: number | null;
  expected_cash: number | null;
};

type ClientRow = {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PdfRow = {
  id: number;
  entity_type: PdfRecord["entityType"];
  entity_id: number;
  file_name: string;
  drive_file_id: string;
  drive_url: string;
  mime_type: string;
  created_at: string;
};

function toMillis(value: string | null | undefined) {
  return value ? new Date(value).getTime() : undefined;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    lowStockAlertThreshold: row.low_stock_alert_threshold,
    category: row.category,
    slug: row.slug,
    saleType: row.sale_type,
    stockUnit: row.stock_unit,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    lastUpdated: toMillis(row.last_updated) ?? Date.now(),
  };
}

function mapOrderRow(row: SaleRow): Order {
  return {
    id: row.id,
    items: (row.detalle_ventas ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id ?? 0,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      saleType: item.sale_type,
      stockUnit: item.stock_unit,
      step: item.step,
    })),
    total: row.total,
    status: row.status,
    createdAt: toMillis(row.created_at) ?? Date.now(),
    notes: row.notes ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    shiftId: row.shift_id ?? undefined,
    clientId: row.client_id ?? undefined,
    userId: row.user_id ?? undefined,
  };
}

function mapShiftRow(row: ShiftRow): Shift {
  return {
    id: row.id,
    status: row.status,
    openedAt: toMillis(row.opened_at) ?? Date.now(),
    openedByUserId: row.opened_by_user_id ?? undefined,
    openingCash: row.opening_cash,
    openingNote: row.opening_note ?? undefined,
    closedAt: toMillis(row.closed_at),
    closedByUserId: row.closed_by_user_id ?? undefined,
    closingNote: row.closing_note ?? undefined,
    orderCount: row.order_count ?? undefined,
    totalSales: row.total_sales ?? undefined,
    cashSales: row.cash_sales ?? undefined,
    mercadoPagoSales: row.mercado_pago_sales ?? undefined,
    transferSales: row.transfer_sales ?? undefined,
    expectedCash: row.expected_cash ?? undefined,
  };
}

function mapClientRow(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
  };
}

function mapPdfRow(row: PdfRow): PdfRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fileName: row.file_name,
    driveFileId: row.drive_file_id,
    driveUrl: row.drive_url,
    mimeType: row.mime_type,
    createdAt: toMillis(row.created_at) ?? Date.now(),
  };
}

function mapProductInput(input: ProductInput) {
  return {
    name: input.name,
    price: input.price,
    cost: input.cost,
    stock: input.stock,
    low_stock_alert_threshold: input.lowStockAlertThreshold,
    category: input.category,
    slug: input.slug,
    sale_type: input.saleType,
    stock_unit: input.stockUnit,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    last_updated: new Date(input.lastUpdated ?? Date.now()).toISOString(),
  };
}

async function expectSingle<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No se encontro el registro solicitado.");
  }
  return data;
}

async function expectMany<T>(promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function getOrderById(orderId: number) {
  const supabase = createServiceRoleSupabaseClient();

  const row = await expectSingle(
    supabase
      .from("ventas")
      .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,detalle_ventas(*)")
      .eq("id", orderId)
      .single(),
  );

  return mapOrderRow(row as SaleRow);
}

async function getShiftById(shiftId: number) {
  const supabase = createServiceRoleSupabaseClient();

  const row = await expectSingle(
    supabase
      .from("arqueos")
      .select("*")
      .eq("id", shiftId)
      .single(),
  );

  return mapShiftRow(row as ShiftRow);
}

export async function getBootstrapSnapshot(sessionUser: SessionUser): Promise<RemoteSnapshot> {
  const supabase = createServiceRoleSupabaseClient();
  const isAdmin = sessionUser.role === "admin";
  const userId = sessionUser.id ?? null;
  const salesQuery = supabase
    .from("ventas")
    .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,detalle_ventas(*)")
    .order("created_at", { ascending: false });
  const shiftsQuery = supabase.from("arqueos").select("*").order("opened_at", { ascending: false });

  if (!isAdmin && userId !== null) {
    salesQuery.eq("user_id", userId);
    shiftsQuery.eq("opened_by_user_id", userId);
  }

  const [products, sales, shifts, clients, pdfs] = await Promise.all([
    expectMany(supabase.from("productos").select("*").order("name")),
    expectMany(salesQuery),
    expectMany(shiftsQuery),
    expectMany(supabase.from("clientes").select("*").order("full_name")),
    expectMany(supabase.from("pdfs").select("*").order("created_at", { ascending: false })),
  ]);

  return {
    products: (products as ProductRow[]).map(mapProductRow),
    orders: (sales as SaleRow[]).map(mapOrderRow),
    shifts: (shifts as ShiftRow[]).map(mapShiftRow),
    clients: (clients as ClientRow[]).map(mapClientRow),
    pdfs: (pdfs as PdfRow[]).map(mapPdfRow),
  };
}

export async function createProduct(input: ProductInput) {
  const supabase = createServiceRoleSupabaseClient();

  const row = await expectSingle(
    supabase
      .from("productos")
      .insert(mapProductInput(input))
      .select("*")
      .single(),
  );

  return mapProductRow(row as ProductRow);
}

export async function updateProduct(id: number, input: ProductInput) {
  const supabase = createServiceRoleSupabaseClient();

  const row = await expectSingle(
    supabase
      .from("productos")
      .update(mapProductInput(input))
      .eq("id", id)
      .select("*")
      .single(),
  );

  return mapProductRow(row as ProductRow);
}

export async function deleteProduct(id: number) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function replaceProducts(products: ProductInput[]) {
  const supabase = createServiceRoleSupabaseClient();
  const { error: deleteError } = await supabase.from("productos").delete().neq("id", 0);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (products.length === 0) {
    return [];
  }

  const inserted = await expectMany(
    supabase
      .from("productos")
      .insert(products.map(mapProductInput))
      .select("*"),
  );

  return (inserted as ProductRow[]).map(mapProductRow);
}

export async function listClients() {
  const supabase = createServiceRoleSupabaseClient();
  const rows = await expectMany(supabase.from("clientes").select("*").order("full_name"));
  return (rows as ClientRow[]).map(mapClientRow);
}

export async function createClient(input: Omit<ClientRecord, "id" | "createdAt" | "updatedAt">) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("clientes")
      .insert({
        full_name: input.fullName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      })
      .select("*")
      .single(),
  );

  return mapClientRow(row as ClientRow);
}

export async function updateClient(id: number, input: Omit<ClientRecord, "id" | "createdAt" | "updatedAt">) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("clientes")
      .update({
        full_name: input.fullName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      })
      .eq("id", id)
      .select("*")
      .single(),
  );

  return mapClientRow(row as ClientRow);
}

export async function deleteClient(id: number) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

async function storePdfRecord({
  entityType,
  entityId,
  fileName,
  driveFileId,
  driveUrl,
}: {
  entityType: PdfRecord["entityType"];
  entityId: number;
  fileName: string;
  driveFileId: string;
  driveUrl: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("pdfs")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: fileName,
        drive_file_id: driveFileId,
        drive_url: driveUrl,
        mime_type: "application/pdf",
      })
      .select("*")
      .single(),
  );

  return mapPdfRow(row as PdfRow);
}

export async function generateSalePdf(orderId: number): Promise<PdfGenerationResult> {
  const order = await getOrderById(orderId);
  const fileName = `venta-${order.id}-${new Date(order.createdAt).toISOString().slice(0, 10)}.pdf`;
  const pdfBytes = await renderSalePdf(order);
  const uploaded = await uploadPdfToDrive({ fileName, buffer: pdfBytes });
  const record = await storePdfRecord({
    entityType: "sale",
    entityId: orderId,
    fileName,
    driveFileId: uploaded.driveFileId,
    driveUrl: uploaded.driveUrl,
  });

  return {
    record,
    base64: Buffer.from(pdfBytes).toString("base64"),
  };
}

export async function generateShiftPdf(shiftId: number): Promise<PdfGenerationResult> {
  const supabase = createServiceRoleSupabaseClient();
  const shift = await getShiftById(shiftId);
  const saleRows = await expectMany(
    supabase
      .from("ventas")
      .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,detalle_ventas(*)")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false }),
  );
  const orders = (saleRows as SaleRow[]).map(mapOrderRow);
  const fileName = `arqueo-${shift.id}-${new Date(shift.openedAt).toISOString().slice(0, 10)}.pdf`;
  const pdfBytes = await renderShiftPdf({ shift, orders });
  const uploaded = await uploadPdfToDrive({ fileName, buffer: pdfBytes });
  const record = await storePdfRecord({
    entityType: "shift",
    entityId: shiftId,
    fileName,
    driveFileId: uploaded.driveFileId,
    driveUrl: uploaded.driveUrl,
  });

  return {
    record,
    base64: Buffer.from(pdfBytes).toString("base64"),
  };
}

export async function createCheckout(input: CheckoutPayload, sessionUser: SessionUser): Promise<CheckoutResult> {
  const supabase = createServiceRoleSupabaseClient();
  const payload = {
    user_id: sessionUser.id ?? null,
    total: input.total,
    notes: input.notes ?? null,
    payment_method: input.paymentMethod,
    client_id: input.clientId ?? null,
    items: input.cartItems.map((item) => ({
      product_id: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      sale_type: item.saleType,
      stock_unit: item.stockUnit,
      step: item.step,
    })),
  };

  const { data, error } = await supabase.rpc("create_sale", {
    p_payload: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  const orderId = Number(data);
  if (!Number.isFinite(orderId)) {
    throw new Error("Supabase no devolvio un id de venta valido.");
  }

  const order = await getOrderById(orderId);
  const productIds = input.cartItems.map((item) => item.productId);
  const productRows = await expectMany(
    supabase.from("productos").select("*").in("id", productIds),
  );
  const updatedProducts = (productRows as ProductRow[]).map(mapProductRow);
  const shift = order.shiftId ? await getShiftById(order.shiftId) : null;
  let pdf: PdfGenerationResult | null = null;

  if (input.generatePdf) {
    try {
      pdf = await generateSalePdf(orderId);
    } catch (error) {
      console.error("No se pudo generar o subir el PDF de la venta:", error);
    }
  }

  return {
    order,
    updatedProducts,
    shift,
    pdf,
  };
}

export async function openShift(input: ShiftOpenInput) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("open_shift", {
    p_opening_cash: input.openingCash,
    p_opening_note: input.openingNote ?? null,
    p_user_id: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getShiftById(Number(data));
}

export async function openShiftForUser(input: ShiftOpenInput, sessionUser: SessionUser) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("open_shift", {
    p_opening_cash: input.openingCash,
    p_opening_note: input.openingNote ?? null,
    p_user_id: sessionUser.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getShiftById(Number(data));
}

export async function closeShift(shiftId: number, input: ShiftCloseInput) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_closing_note: input.closingNote ?? null,
    p_user_id: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const closedShiftId = Number(data ?? shiftId);
  const shift = await getShiftById(closedShiftId);
  let pdf: PdfGenerationResult | null = null;

  if (input.generatePdf) {
    try {
      pdf = await generateShiftPdf(closedShiftId);
    } catch (error) {
      console.error("No se pudo generar o subir el PDF del arqueo:", error);
    }
  }

  return {
    shift,
    pdf,
  };
}

export async function closeShiftForUser(shiftId: number, input: ShiftCloseInput, sessionUser: SessionUser) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_closing_note: input.closingNote ?? null,
    p_user_id: sessionUser.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const closedShiftId = Number(data ?? shiftId);
  const shift = await getShiftById(closedShiftId);
  let pdf: PdfGenerationResult | null = null;

  if (input.generatePdf) {
    try {
      pdf = await generateShiftPdf(closedShiftId);
    } catch (error) {
      console.error("No se pudo generar o subir el PDF del arqueo:", error);
    }
  }

  return {
    shift,
    pdf,
  };
}
