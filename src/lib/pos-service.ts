import "server-only";

import type {
  CheckoutPayload,
  CheckoutResult,
  ClientRecord,
  LocalRecord,
  SessionUser,
  Order,
  PaymentMethod,
  PdfGenerationResult,
  PdfRecord,
  Product,
  ProductInput,
  ProductLocalStock,
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

type ProductLocalStockRow = {
  id: number;
  product_id: number;
  local_id: number;
  stock: number;
  low_stock_alert_threshold: number;
  created_at: string;
  updated_at: string;
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
  local_id: number | null;
  detalle_ventas?: SaleDetailRow[] | null;
};

type ShiftRow = {
  id: number;
  status: Shift["status"];
  opened_at: string;
  opening_cash: number;
  opened_by_user_id: number | null;
  local_id: number | null;
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

type AppUserReferenceRow = {
  id: number;
  full_name: string;
  locale_id: number | null;
};

type LocalRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

function toMillis(value: string | null | undefined) {
  return value ? new Date(value).getTime() : undefined;
}

function mapProductLocalStockRow(
  row: ProductLocalStockRow,
  localNamesById?: Map<number, LocalRow>,
): ProductLocalStock {
  return {
    localId: row.local_id,
    localName: localNamesById?.get(row.local_id)?.name,
    stock: row.stock,
    lowStockAlertThreshold: row.low_stock_alert_threshold,
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
  };
}

function createProductLocalStockMap(rows: ProductLocalStockRow[]) {
  return rows.reduce<Map<number, ProductLocalStockRow[]>>((acc, row) => {
    const current = acc.get(row.product_id) ?? [];
    current.push(row);
    acc.set(row.product_id, current);
    return acc;
  }, new Map<number, ProductLocalStockRow[]>());
}

function mapProductRow(
  row: ProductRow,
  localStocksByProductId?: Map<number, ProductLocalStockRow[]>,
  localNamesById?: Map<number, LocalRow>,
  activeLocalId?: number | null,
): Product {
  const localStocks = (localStocksByProductId?.get(row.id) ?? [])
    .map((stockRow) => mapProductLocalStockRow(stockRow, localNamesById))
    .sort((a, b) => (a.localName ?? "").localeCompare(b.localName ?? ""));
  const preferredLocalStock =
    activeLocalId === undefined || activeLocalId === null
      ? undefined
      : localStocks.find((stockRow) => stockRow.localId === activeLocalId);
  const projectedLocalStock = preferredLocalStock ?? (localStocks.length === 1 ? localStocks[0] : undefined);

  return {
    id: row.id,
    name: row.name,
    price: row.price,
    cost: row.cost,
    stock: projectedLocalStock?.stock ?? row.stock,
    lowStockAlertThreshold:
      projectedLocalStock?.lowStockAlertThreshold ?? row.low_stock_alert_threshold,
    category: row.category,
    slug: row.slug,
    saleType: row.sale_type,
    stockUnit: row.stock_unit,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    localStocks: localStocks.length > 0 ? localStocks : undefined,
    lastUpdated: toMillis(row.last_updated) ?? Date.now(),
  };
}

function mapOrderRow(
  row: SaleRow,
  userNamesById?: Map<number, AppUserReferenceRow>,
  localNamesById?: Map<number, LocalRow>,
): Order {
  const userReference = row.user_id ? userNamesById?.get(row.user_id) : undefined;
  const localReference = row.local_id ? localNamesById?.get(row.local_id) : undefined;

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
    localId: row.local_id ?? undefined,
    userFullName: userReference?.full_name ?? undefined,
    localName: localReference?.name ?? undefined,
  };
}

function mapShiftRow(row: ShiftRow, localNamesById?: Map<number, LocalRow>): Shift {
  const localReference = row.local_id ? localNamesById?.get(row.local_id) : undefined;

  return {
    id: row.id,
    status: row.status,
    openedAt: toMillis(row.opened_at) ?? Date.now(),
    openedByUserId: row.opened_by_user_id ?? undefined,
    localId: row.local_id ?? undefined,
    localName: localReference?.name ?? undefined,
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

function createUserReferenceMap(rows: AppUserReferenceRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function createLocalMap(rows: LocalRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function mapLocalRow(row: LocalRow): LocalRecord {
  return {
    id: row.id,
    name: row.name,
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

function mapProductInput(input: ProductInput, preferredLocalId?: number | null) {
  const preferredLocalStock =
    input.localStocks?.find((localStock) => localStock.localId === preferredLocalId) ??
    input.localStocks?.[0];

  return {
    name: input.name,
    price: input.price,
    cost: input.cost,
    stock: preferredLocalStock?.stock ?? input.stock,
    low_stock_alert_threshold:
      preferredLocalStock?.lowStockAlertThreshold ?? input.lowStockAlertThreshold,
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

async function listLocalRows() {
  const supabase = createServiceRoleSupabaseClient();
  return expectMany(supabase.from("locales").select("*").order("name"));
}

function normalizeProductLocalStocks(input: ProductInput, localRows: LocalRow[]) {
  if (input.localStocks && input.localStocks.length > 0) {
    const uniqueStocks = new Map<number, ProductLocalStock>();

    input.localStocks.forEach((localStock) => {
      if (!Number.isFinite(localStock.localId)) {
        return;
      }

      uniqueStocks.set(localStock.localId, {
        localId: localStock.localId,
        stock: Math.max(0, localStock.stock),
        lowStockAlertThreshold: Math.max(0, localStock.lowStockAlertThreshold),
      });
    });

    return Array.from(uniqueStocks.values());
  }

  return localRows.map((localRow) => ({
    localId: localRow.id,
    stock: Math.max(0, input.stock),
    lowStockAlertThreshold: Math.max(0, input.lowStockAlertThreshold),
  }));
}

async function replaceProductLocalStocks(
  productId: number,
  localStocks: ProductLocalStock[],
) {
  const supabase = createServiceRoleSupabaseClient();
  const { error: deleteError } = await supabase
    .from("productos_stock_local")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (localStocks.length === 0) {
    return [] as ProductLocalStockRow[];
  }

  const inserted = await expectMany(
    supabase
      .from("productos_stock_local")
      .insert(
        localStocks.map((localStock) => ({
          product_id: productId,
          local_id: localStock.localId,
          stock: localStock.stock,
          low_stock_alert_threshold: localStock.lowStockAlertThreshold,
        })),
      )
      .select("*"),
  );

  return inserted as ProductLocalStockRow[];
}

async function getOrderById(orderId: number) {
  const supabase = createServiceRoleSupabaseClient();

  const row = await expectSingle(
    supabase
      .from("ventas")
      .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,local_id,detalle_ventas(*)")
      .eq("id", orderId)
      .single(),
  );

  const saleRow = row as SaleRow;
  const [userRows, localRows] = await Promise.all([
    saleRow.user_id
      ? expectMany(
          supabase.from("app_users").select("id,full_name,locale_id").eq("id", saleRow.user_id),
        )
      : Promise.resolve([] as AppUserReferenceRow[]),
    saleRow.local_id
      ? expectMany(supabase.from("locales").select("*").eq("id", saleRow.local_id))
      : Promise.resolve([] as LocalRow[]),
  ]);

  return mapOrderRow(
    saleRow,
    createUserReferenceMap(userRows as AppUserReferenceRow[]),
    createLocalMap(localRows as LocalRow[]),
  );
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

  const shiftRow = row as ShiftRow;
  const localRows =
    shiftRow.local_id
      ? await expectMany(supabase.from("locales").select("*").eq("id", shiftRow.local_id))
      : [];

  return mapShiftRow(shiftRow, createLocalMap(localRows as LocalRow[]));
}

export async function getBootstrapSnapshot(sessionUser: SessionUser): Promise<RemoteSnapshot> {
  const supabase = createServiceRoleSupabaseClient();
  const isAdmin = sessionUser.role === "admin";
  const userId = sessionUser.id ?? null;
  const activeLocalId = sessionUser.localId ?? null;
  const salesQuery = supabase
    .from("ventas")
    .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,local_id,detalle_ventas(*)")
    .order("created_at", { ascending: false });
  const shiftsQuery = supabase.from("arqueos").select("*").order("opened_at", { ascending: false });
  const productLocalStocksQuery = supabase.from("productos_stock_local").select("*");

  if (!isAdmin && userId !== null) {
    salesQuery.eq("user_id", userId);
    shiftsQuery.eq("opened_by_user_id", userId);
  }

  if (!isAdmin && activeLocalId !== null) {
    productLocalStocksQuery.eq("local_id", activeLocalId);
  }

  const [products, productLocalStocks, sales, shifts, clients, pdfs, userRows, localRows] = await Promise.all([
    expectMany(supabase.from("productos").select("*").order("name")),
    expectMany(productLocalStocksQuery),
    expectMany(salesQuery),
    expectMany(shiftsQuery),
    expectMany(supabase.from("clientes").select("*").order("full_name")),
    expectMany(supabase.from("pdfs").select("*").order("created_at", { ascending: false })),
    expectMany(supabase.from("app_users").select("id,full_name,locale_id")),
    expectMany(supabase.from("locales").select("*").order("name")),
  ]);

  const userNamesById = createUserReferenceMap(userRows as AppUserReferenceRow[]);
  const localNamesById = createLocalMap(localRows as LocalRow[]);
  const localStocksByProductId = createProductLocalStockMap(productLocalStocks as ProductLocalStockRow[]);

  return {
    locales: (localRows as LocalRow[]).map(mapLocalRow),
    products: (products as ProductRow[]).map((row) =>
      mapProductRow(row, localStocksByProductId, localNamesById, activeLocalId),
    ),
    orders: (sales as SaleRow[]).map((row) => mapOrderRow(row, userNamesById, localNamesById)),
    shifts: (shifts as ShiftRow[]).map((row) => mapShiftRow(row, localNamesById)),
    clients: (clients as ClientRow[]).map(mapClientRow),
    pdfs: (pdfs as PdfRow[]).map(mapPdfRow),
  };
}

export async function createProduct(input: ProductInput, sessionUser?: SessionUser | null) {
  const supabase = createServiceRoleSupabaseClient();
  const preferredLocalId = sessionUser?.localId ?? null;
  const localRows = (await listLocalRows()) as LocalRow[];

  const row = await expectSingle(
    supabase
      .from("productos")
      .insert(mapProductInput(input, preferredLocalId))
      .select("*")
      .single(),
  );

  const createdProduct = row as ProductRow;
  const normalizedLocalStocks = normalizeProductLocalStocks(input, localRows);
  const localStockRows = await replaceProductLocalStocks(createdProduct.id, normalizedLocalStocks);
  const localNamesById = createLocalMap(localRows);

  return mapProductRow(
    createdProduct,
    createProductLocalStockMap(localStockRows),
    localNamesById,
    preferredLocalId,
  );
}

export async function updateProduct(id: number, input: ProductInput, sessionUser?: SessionUser | null) {
  const supabase = createServiceRoleSupabaseClient();
  const preferredLocalId = sessionUser?.localId ?? null;
  const localRows = (await listLocalRows()) as LocalRow[];

  const row = await expectSingle(
    supabase
      .from("productos")
      .update(mapProductInput(input, preferredLocalId))
      .eq("id", id)
      .select("*")
      .single(),
  );

  const updatedProduct = row as ProductRow;
  const normalizedLocalStocks = normalizeProductLocalStocks(input, localRows);
  const localStockRows = await replaceProductLocalStocks(updatedProduct.id, normalizedLocalStocks);
  const localNamesById = createLocalMap(localRows);

  return mapProductRow(
    updatedProduct,
    createProductLocalStockMap(localStockRows),
    localNamesById,
    preferredLocalId,
  );
}

export async function deleteProduct(id: number) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function replaceProducts(products: ProductInput[], sessionUser?: SessionUser | null) {
  const supabase = createServiceRoleSupabaseClient();
  const preferredLocalId = sessionUser?.localId ?? null;
  const localRows = (await listLocalRows()) as LocalRow[];
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
      .insert(products.map((product) => mapProductInput(product, preferredLocalId)))
      .select("*"),
  );

  const insertedRows = inserted as ProductRow[];
  const insertedBySlug = new Map(insertedRows.map((row) => [row.slug, row]));
  const localStockInserts = products.flatMap((product) => {
    const insertedRow = insertedBySlug.get(product.slug);
    if (!insertedRow) {
      return [];
    }

    return normalizeProductLocalStocks(product, localRows).map((localStock) => ({
      product_id: insertedRow.id,
      local_id: localStock.localId,
      stock: localStock.stock,
      low_stock_alert_threshold: localStock.lowStockAlertThreshold,
    }));
  });

  if (localStockInserts.length > 0) {
    const { error: localStockError } = await supabase.from("productos_stock_local").insert(localStockInserts);
    if (localStockError) {
      throw new Error(localStockError.message);
    }
  }

  const localStockRows = localStockInserts.length > 0
    ? (await expectMany(
        supabase
          .from("productos_stock_local")
          .select("*")
          .in(
            "product_id",
            insertedRows.map((row) => row.id),
          ),
      )) as ProductLocalStockRow[]
    : [];

  const localNamesById = createLocalMap(localRows);
  const localStocksByProductId = createProductLocalStockMap(localStockRows);

  return insertedRows.map((row) =>
    mapProductRow(row, localStocksByProductId, localNamesById, preferredLocalId),
  );
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
      .select("id,total,status,created_at,notes,payment_method,shift_id,client_id,user_id,local_id,detalle_ventas(*)")
      .eq("shift_id", shiftId)
      .order("created_at", { ascending: false }),
  );
  const [userRows, localRows] = await Promise.all([
    expectMany(supabase.from("app_users").select("id,full_name,locale_id")),
    expectMany(supabase.from("locales").select("*").order("name")),
  ]);
  const orders = (saleRows as SaleRow[]).map((row) =>
    mapOrderRow(
      row,
      createUserReferenceMap(userRows as AppUserReferenceRow[]),
      createLocalMap(localRows as LocalRow[]),
    ),
  );
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
  const [productRows, productLocalStockRows, localRows] = await Promise.all([
    expectMany(supabase.from("productos").select("*").in("id", productIds)),
    sessionUser.localId
      ? expectMany(
          supabase
            .from("productos_stock_local")
            .select("*")
            .eq("local_id", sessionUser.localId)
            .in("product_id", productIds),
        )
      : Promise.resolve([] as ProductLocalStockRow[]),
    sessionUser.localId
      ? expectMany(supabase.from("locales").select("*").eq("id", sessionUser.localId))
      : Promise.resolve([] as LocalRow[]),
  ]);
  const updatedProducts = (productRows as ProductRow[]).map((row) =>
    mapProductRow(
      row,
      createProductLocalStockMap(productLocalStockRows as ProductLocalStockRow[]),
      createLocalMap(localRows as LocalRow[]),
      sessionUser.localId ?? null,
    ),
  );
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
