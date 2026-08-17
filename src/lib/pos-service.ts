import "server-only";

import type {
  CheckoutPayload,
  CheckoutResult,
  ClientInput,
  ClientRecord,
  LocalCreateInput,
  LocalRecord,
  LocalUpdateInput,
  SessionUser,
  Order,
  PaymentMethod,
  PdfGenerationResult,
  PdfRecord,
  Product,
  ProductInput,
  ProductLocalStock,
  ProductStockUpdate,
  ReservationCreateInput,
  ReservationMutationResult,
  ReservationPayment,
  ReservationPaymentInput,
  ReservationPlan,
  RemoteSnapshot,
  SalesResetInput,
  SalesResetResult,
  Shift,
  ShiftCloseInput,
  ShiftOpenInput,
} from "./pos-types";
import { uploadPdfToDrive } from "./google/drive";
import { renderSalePdf, renderShiftPdf } from "./pdf/documents";
import { createServiceRoleSupabaseClient } from "./supabase/server";

type ProductRow = {
  id: number;
  code: string | null;
  name: string;
  price: number;
  cost: number;
  stock: number;
  low_stock_alert_threshold: number;
  category: string;
  subcategory: string | null;
  slug: string;
  sale_type: Product["saleType"];
  stock_unit: Product["stockUnit"];
  description: string | null;
  image_url: string | null;
  last_updated: string;
};

const PRODUCT_BOOTSTRAP_COLUMNS =
  "id,code,name,price,cost,stock,low_stock_alert_threshold,category,subcategory,slug,sale_type,stock_unit,description,last_updated";
const RESERVATION_SELECT =
  "*,clientes(id,full_name,phone),locales(id,name),reservation_plan_items(*),reservation_payments(*)";

function productImagePath(productId: number, lastUpdated?: string) {
  const version = lastUpdated ? `?v=${encodeURIComponent(lastUpdated)}` : "";
  return `/api/products/${productId}/image${version}`;
}

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
  counted_cash: number | null;
  cash_difference: number | null;
  reservation_collections: number | null;
  reservation_cash: number | null;
  reservation_mercado_pago: number | null;
  reservation_transfer: number | null;
};

type FastCheckoutStockRow = {
  product_id: number;
  global_stock: number;
  local_id: number | null;
  local_stock: number | null;
  last_updated: string;
};

type FastCheckoutResult = {
  order: SaleRow;
  shift: ShiftRow;
  stock_updates: FastCheckoutStockRow[];
};

type ClientRow = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  dni: string | null;
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
  logo_url: string | null;
  thermal_printer_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type ReservationItemRow = {
  id: number;
  plan_id: number;
  product_id: number | null;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

type ReservationPaymentRow = {
  id: number;
  plan_id: number;
  shift_id: number | null;
  amount: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
};

type ReservationPlanRow = {
  id: number;
  client_id: number;
  user_id: number | null;
  local_id: number | null;
  status: ReservationPlan["status"];
  total_amount: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  clientes?: Pick<ClientRow, "id" | "full_name" | "phone"> | null;
  locales?: Pick<LocalRow, "id" | "name"> | null;
  reservation_plan_items?: ReservationItemRow[] | null;
  reservation_payments?: ReservationPaymentRow[] | null;
};

type ReservationRpcResult = {
  plan_id: number;
  shift_id: number;
  stock_updates?: FastCheckoutStockRow[];
};

const LOCAL_LOGO_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
const MAX_LOCAL_LOGO_DATA_URL_LENGTH = 400_000;

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
  const globalStock =
    localStocks.length > 0 ? localStocks.reduce((acc, localStock) => acc + localStock.stock, 0) : row.stock;
  const globalLowStockAlertThreshold =
    localStocks.length > 0
      ? localStocks.reduce((acc, localStock) => acc + localStock.lowStockAlertThreshold, 0)
      : row.low_stock_alert_threshold;
  const preferredLocalStock =
    activeLocalId === undefined || activeLocalId === null
      ? undefined
      : localStocks.find((stockRow) => stockRow.localId === activeLocalId);
  const projectedLocalStock =
    preferredLocalStock ??
    (localStocks.length === 1
      ? localStocks[0]
      : activeLocalId === undefined || activeLocalId === null
        ? undefined
        : {
            localId: activeLocalId,
            localName: localNamesById?.get(activeLocalId)?.name,
            stock: 0,
            lowStockAlertThreshold: row.low_stock_alert_threshold,
          });

  return {
    id: row.id,
    code: row.code ?? undefined,
    name: row.name,
    price: row.price,
    cost: row.cost,
    stock: projectedLocalStock?.stock ?? row.stock,
    globalStock,
    lowStockAlertThreshold:
      projectedLocalStock?.lowStockAlertThreshold ?? row.low_stock_alert_threshold,
    globalLowStockAlertThreshold,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    slug: row.slug,
    saleType: row.sale_type,
    stockUnit: row.stock_unit,
    description: row.description ?? undefined,
    imageUrl: row.image_url ? productImagePath(row.id, row.last_updated) : undefined,
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
    countedCash: row.counted_cash ?? undefined,
    cashDifference: row.cash_difference ?? undefined,
    reservationCollections: row.reservation_collections ?? 0,
    reservationCash: row.reservation_cash ?? 0,
    reservationMercadoPago: row.reservation_mercado_pago ?? 0,
    reservationTransfer: row.reservation_transfer ?? 0,
  };
}

function mapClientRow(row: ClientRow): ClientRecord {
  const firstName = row.first_name?.trim() || row.full_name.trim();
  const lastName = row.last_name?.trim() || "";

  return {
    id: row.id,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    address: row.address ?? undefined,
    dni: row.dni ?? undefined,
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
    logoUrl: row.logo_url ?? undefined,
    thermalPrinterEnabled: row.thermal_printer_enabled,
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
  const resolvedPreferredLocalId = input.preferredLocalId ?? preferredLocalId;
  const preferredLocalStock =
    input.localStocks?.find((localStock) => localStock.localId === resolvedPreferredLocalId) ??
    input.localStocks?.[0];

  return {
    code: input.code?.trim() || null,
    name: input.name,
    price: input.price,
    cost: input.cost,
    stock: preferredLocalStock?.stock ?? input.stock,
    low_stock_alert_threshold:
      preferredLocalStock?.lowStockAlertThreshold ?? input.lowStockAlertThreshold,
    category: input.category,
    subcategory: input.subcategory?.trim() || null,
    slug: input.slug,
    sale_type: input.saleType,
    stock_unit: input.stockUnit,
    description: input.description ?? null,
    image_url: input.imageUrl ?? null,
    last_updated: new Date(input.lastUpdated ?? Date.now()).toISOString(),
  };
}

async function expectSingle<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  mapErrorMessage?: (message: string) => string,
) {
  const { data, error } = await promise;
  if (error) {
    throw new Error(mapErrorMessage?.(error.message) ?? error.message);
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

export async function createLocal(input: LocalCreateInput): Promise<LocalRecord> {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Debes indicar un nombre para el local.");
  }

  const existing = await expectMany(
    supabase.from("locales").select("*").ilike("name", normalizedName).limit(1),
  );

  if (existing.length > 0) {
    return mapLocalRow(existing[0] as LocalRow);
  }

  const created = await expectSingle(
    supabase
      .from("locales")
      .insert({
        name: normalizedName,
        thermal_printer_enabled: input.thermalPrinterEnabled ?? true,
      })
      .select("*")
      .single(),
  );

  const createdLocal = created as LocalRow;
  const products = (await expectMany(
    supabase.from("productos").select("id,low_stock_alert_threshold"),
  )) as Array<{ id: number; low_stock_alert_threshold: number | null }>;

  if (products.length > 0) {
    const { error: stockSeedError } = await supabase.from("productos_stock_local").insert(
      products.map((product) => ({
        product_id: product.id,
        local_id: createdLocal.id,
        stock: 0,
        low_stock_alert_threshold: product.low_stock_alert_threshold ?? 5,
      })),
    );

    if (stockSeedError) {
      throw new Error(stockSeedError.message);
    }
  }

  return mapLocalRow(createdLocal);
}

export async function updateLocal(localId: number, input: LocalUpdateInput): Promise<LocalRecord> {
  const supabase = createServiceRoleSupabaseClient();

  if (!Number.isFinite(localId)) {
    throw new Error("Debes indicar un local valido.");
  }

  const updates: {
    name?: string;
    logo_url?: string | null;
    thermal_printer_enabled?: boolean;
  } = {};

  if (typeof input.name === "string") {
    const normalizedName = input.name.trim();

    if (!normalizedName) {
      throw new Error("Debes indicar un nombre para el local.");
    }

    const existingByName = (await expectMany(
      supabase.from("locales").select("*").ilike("name", normalizedName).limit(1),
    )) as LocalRow[];

    if (existingByName.length > 0 && existingByName[0].id !== localId) {
      throw new Error("Ya existe otro local con ese nombre.");
    }

    updates.name = normalizedName;
  }

  if (typeof input.thermalPrinterEnabled === "boolean") {
    updates.thermal_printer_enabled = input.thermalPrinterEnabled;
  }

  if (input.logoUrl !== undefined) {
    const normalizedLogoUrl = input.logoUrl?.trim() || null;

    if (
      normalizedLogoUrl &&
      (!LOCAL_LOGO_DATA_URL_PATTERN.test(normalizedLogoUrl) ||
        normalizedLogoUrl.length > MAX_LOCAL_LOGO_DATA_URL_LENGTH)
    ) {
      throw new Error("El logo debe ser una imagen JPG, PNG o WebP de hasta 300 KB.");
    }

    updates.logo_url = normalizedLogoUrl;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No hay cambios para guardar en el local.");
  }

  const updated = await expectSingle(
    supabase
      .from("locales")
      .update(updates)
      .eq("id", localId)
      .select("*")
      .single(),
  );

  return mapLocalRow(updated as LocalRow);
}

export async function deleteLocal(localId: number) {
  const supabase = createServiceRoleSupabaseClient();

  if (!Number.isFinite(localId)) {
    throw new Error("Debes indicar un local valido.");
  }

  const assignedUsers = await expectMany(
    supabase.from("app_users").select("id").eq("locale_id", localId).limit(1),
  );

  if (assignedUsers.length > 0) {
    throw new Error("No puedes borrar un local que todavia tiene usuarios asignados.");
  }

  const { error } = await supabase.from("locales").delete().eq("id", localId);

  if (error) {
    throw new Error(error.message);
  }
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

async function storeShiftCashCount(
  shiftId: number,
  countedCash: number,
) {
  const supabase = createServiceRoleSupabaseClient();
  const currentShift = await getShiftById(shiftId);
  const expectedCash = currentShift.expectedCash ?? currentShift.openingCash;
  const cashDifference = countedCash - expectedCash;

  const { error } = await supabase
    .from("arqueos")
    .update({
      counted_cash: countedCash,
      cash_difference: cashDifference,
    })
    .eq("id", shiftId);

  if (error) {
    throw new Error(error.message);
  }
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

  const [products, productImages, productLocalStocks, sales, shifts, clients, pdfs, userRows, localRows] = await Promise.all([
    expectMany(supabase.from("productos").select(PRODUCT_BOOTSTRAP_COLUMNS).order("name")),
    expectMany(supabase.from("productos").select("id").not("image_url", "is", null)),
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
  const productIdsWithImages = new Set(
    (productImages as Array<{ id: number }>).map((product) => product.id),
  );

  return {
    locales: (localRows as LocalRow[]).map(mapLocalRow),
    products: (products as Array<Omit<ProductRow, "image_url">>).map((row) =>
      mapProductRow(
        { ...row, image_url: productIdsWithImages.has(row.id) ? productImagePath(row.id, row.last_updated) : null },
        localStocksByProductId,
        localNamesById,
        activeLocalId,
      ),
    ),
    orders: (sales as SaleRow[]).map((row) => mapOrderRow(row, userNamesById, localNamesById)),
    shifts: (shifts as ShiftRow[]).map((row) => mapShiftRow(row, localNamesById)),
    clients: (clients as ClientRow[]).map(mapClientRow),
    pdfs: (pdfs as PdfRow[]).map(mapPdfRow),
  };
}

export async function createProduct(input: ProductInput, sessionUser?: SessionUser | null) {
  const supabase = createServiceRoleSupabaseClient();
  const preferredLocalId = input.preferredLocalId ?? sessionUser?.localId ?? null;
  const localRows = (await listLocalRows()) as LocalRow[];

  const row = await expectSingle(
    supabase
      .from("productos")
      .insert(mapProductInput(input, preferredLocalId))
      .select("*")
      .single(),
    productWriteErrorMessage,
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
  const preferredLocalId = input.preferredLocalId ?? sessionUser?.localId ?? null;
  const localRows = (await listLocalRows()) as LocalRow[];

  const mappedInput = mapProductInput(input, preferredLocalId);
  const { image_url: _currentImagePath, ...mappedInputWithoutImage } = mappedInput;
  void _currentImagePath;
  const keepsExistingImage = input.imageUrl?.startsWith(`/api/products/${id}/image`);

  const row = await expectSingle(
    supabase
      .from("productos")
      .update(keepsExistingImage ? mappedInputWithoutImage : mappedInput)
      .eq("id", id)
      .select("*")
      .single(),
    productWriteErrorMessage,
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

  return insertedRows.map((row) => {
    const sourceProduct = products.find((product) => product.slug === row.slug);
    const mappedPreferredLocalId = sourceProduct?.preferredLocalId ?? preferredLocalId;
    return mapProductRow(row, localStocksByProductId, localNamesById, mappedPreferredLocalId);
  });
}

export async function listClients() {
  const supabase = createServiceRoleSupabaseClient();
  const rows = await expectMany(supabase.from("clientes").select("*").order("full_name"));
  return (rows as ClientRow[]).map(mapClientRow);
}

export async function moveProductCategory(sourceCategory: string, targetCategory: string) {
  const source = sourceCategory.trim();
  const target = targetCategory.trim();

  if (!source || !target) {
    throw new Error("La categoria de origen y la de destino son obligatorias.");
  }

  if (source.localeCompare(target, "es", { sensitivity: "base" }) === 0) {
    throw new Error("La categoria de destino debe ser diferente.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("productos")
    .update({
      category: target,
      last_updated: new Date().toISOString(),
    })
    .eq("category", source)
    .select("id");

  if (error) {
    if (error.message.includes("productos_category_subcategory_slug_unique_idx")) {
      throw new Error(
        "No se pueden unir esas categorias porque contienen productos con el mismo nombre.",
      );
    }
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("La categoria seleccionada ya no tiene productos.");
  }

  return data.length;
}

function productWriteErrorMessage(message: string) {
  if (message.includes("productos_category_subcategory_slug_unique_idx")) {
    return "Ya existe un producto con ese nombre en la misma categoria y subcategoria.";
  }

  return message;
}

export async function deleteProductCategory(category: string) {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    throw new Error("La categoria es obligatoria.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("productos")
    .delete()
    .eq("category", normalizedCategory)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("La categoria seleccionada ya no tiene productos.");
  }

  return data.length;
}

export async function getProductImageSource(id: number) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase.from("productos").select("image_url").eq("id", id).single(),
  );

  return (row as { image_url: string | null }).image_url;
}

function normalizeClientInput(input: ClientInput) {
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();

  if (!firstName || !lastName) {
    throw new Error("Nombre y apellido son obligatorios.");
  }

  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("El email no es valido.");
  }

  return {
    full_name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    address: input.address?.trim() || null,
    dni: input.dni?.trim() || null,
    phone: input.phone?.trim() || null,
    email,
    notes: input.notes?.trim() || null,
  };
}

export async function createClient(input: ClientInput) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("clientes")
      .insert(normalizeClientInput(input))
      .select("*")
      .single(),
  );

  return mapClientRow(row as ClientRow);
}

export async function updateClient(id: number, input: ClientInput) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("clientes")
      .update(normalizeClientInput(input))
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

  const { data, error } = await supabase.rpc("create_sale_fast", {
    p_payload: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  const checkout = data as FastCheckoutResult | null;
  if (!checkout?.order?.id || !checkout.shift?.id || !Array.isArray(checkout.stock_updates)) {
    throw new Error("Supabase no devolvio una venta valida.");
  }

  const orderId = checkout.order.id;
  const order = {
    ...mapOrderRow(checkout.order),
    userFullName: sessionUser.fullName,
    localName: sessionUser.localName,
  };
  const shift = {
    ...mapShiftRow(checkout.shift),
    localName: sessionUser.localName,
  };
  const stockUpdates: ProductStockUpdate[] = checkout.stock_updates.map((row) => ({
    productId: row.product_id,
    globalStock: row.global_stock,
    localId: row.local_id,
    localStock: row.local_stock,
    lastUpdated: toMillis(row.last_updated) ?? Date.now(),
  }));
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
    stockUpdates,
    // Keep older installed clients from failing after the sale was already committed.
    updatedProducts: [],
    shift,
    pdf,
  };
}

async function getReservationPlanById(planId: number) {
  const supabase = createServiceRoleSupabaseClient();
  const row = await expectSingle(
    supabase
      .from("reservation_plans")
      .select(RESERVATION_SELECT)
      .eq("id", planId)
      .single(),
  );

  return mapReservationPlanRow(row as unknown as ReservationPlanRow);
}

export async function listReservationPlans(sessionUser: SessionUser) {
  const supabase = createServiceRoleSupabaseClient();
  const query = supabase
    .from("reservation_plans")
    .select(RESERVATION_SELECT)
    .order("created_at", { ascending: false });

  if (sessionUser.role !== "admin" && sessionUser.localId) {
    query.eq("local_id", sessionUser.localId);
  }

  const rows = await expectMany(query);
  return (rows as unknown as ReservationPlanRow[]).map(mapReservationPlanRow);
}

export async function createReservationPlan(
  input: ReservationCreateInput,
  sessionUser: SessionUser,
): Promise<ReservationMutationResult> {
  if (!Number.isInteger(input.clientId) || input.clientId <= 0) {
    throw new Error("Selecciona un cliente para crear el plan de reserva.");
  }
  if (!Array.isArray(input.cartItems) || input.cartItems.length === 0) {
    throw new Error("Agrega al menos un producto de electronica.");
  }
  if (!Number.isFinite(input.initialPayment) || input.initialPayment < 0) {
    throw new Error("La entrega inicial no es valida.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("create_reservation_plan", {
    p_payload: {
      user_id: sessionUser.id ?? null,
      client_id: input.clientId,
      initial_payment: input.initialPayment,
      payment_method: input.paymentMethod,
      notes: input.notes?.trim() || null,
      items: input.cartItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as ReservationRpcResult | null;
  if (!result?.plan_id || !result.shift_id) {
    throw new Error("Supabase no devolvio un plan de reserva valido.");
  }

  const [plan, shift] = await Promise.all([
    getReservationPlanById(result.plan_id),
    getShiftById(result.shift_id),
  ]);
  const stockUpdates = (result.stock_updates ?? []).map((row) => ({
    productId: row.product_id,
    globalStock: row.global_stock,
    localId: row.local_id,
    localStock: row.local_stock,
    lastUpdated: toMillis(row.last_updated) ?? Date.now(),
  }));

  return { plan, shift, stockUpdates };
}

export async function addReservationPayment(
  planId: number,
  input: ReservationPaymentInput,
  sessionUser: SessionUser,
): Promise<{ plan: ReservationPlan; shift: Shift }> {
  if (!Number.isInteger(planId) || planId <= 0) {
    throw new Error("El plan de reserva no es valido.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El pago debe ser mayor a cero.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("add_reservation_payment", {
    p_plan_id: planId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_user_id: sessionUser.id ?? null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data as ReservationRpcResult | null;
  if (!result?.plan_id || !result.shift_id) {
    throw new Error("Supabase no devolvio el pago registrado.");
  }

  const [plan, shift] = await Promise.all([
    getReservationPlanById(result.plan_id),
    getShiftById(result.shift_id),
  ]);
  return { plan, shift };
}

export async function deliverReservationPlan(planId: number, sessionUser: SessionUser) {
  if (!Number.isInteger(planId) || planId <= 0) {
    throw new Error("El plan de reserva no es valido.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("deliver_reservation_plan", {
    p_plan_id: planId,
    p_user_id: sessionUser.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const deliveredPlanId = Number(data ?? planId);
  return getReservationPlanById(deliveredPlanId);
}

function mapReservationPaymentRow(row: ReservationPaymentRow): ReservationPayment {
  return {
    id: row.id,
    planId: row.plan_id,
    shiftId: row.shift_id ?? undefined,
    amount: row.amount,
    paymentMethod: row.payment_method,
    notes: row.notes ?? undefined,
    createdAt: toMillis(row.created_at) ?? Date.now(),
  };
}

function mapReservationPlanRow(row: ReservationPlanRow): ReservationPlan {
  const paidAmount = Number(row.paid_amount ?? 0);
  const totalAmount = Number(row.total_amount ?? 0);

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clientes?.full_name ?? `Cliente #${row.client_id}`,
    clientPhone: row.clientes?.phone ?? undefined,
    userId: row.user_id ?? undefined,
    localId: row.local_id ?? undefined,
    localName: row.locales?.name ?? undefined,
    status: row.status,
    totalAmount,
    paidAmount,
    balance: Math.max(0, totalAmount - paidAmount),
    notes: row.notes ?? undefined,
    createdAt: toMillis(row.created_at) ?? Date.now(),
    updatedAt: toMillis(row.updated_at) ?? Date.now(),
    paidAt: toMillis(row.paid_at),
    deliveredAt: toMillis(row.delivered_at),
    items: (row.reservation_plan_items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id ?? undefined,
      name: item.name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
    payments: (row.reservation_payments ?? [])
      .map(mapReservationPaymentRow)
      .sort((a, b) => b.createdAt - a.createdAt),
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

  if (!Number.isFinite(input.countedCash) || Number(input.countedCash) < 0) {
    throw new Error("Debes cargar un arqueo valido antes de cerrar el turno.");
  }

  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_closing_note: input.closingNote ?? null,
    p_user_id: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const closedShiftId = Number(data ?? shiftId);
  await storeShiftCashCount(closedShiftId, Number(input.countedCash));
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

  if (!Number.isFinite(input.countedCash) || Number(input.countedCash) < 0) {
    throw new Error("Debes cargar un arqueo valido antes de cerrar el turno.");
  }

  const { data, error } = await supabase.rpc("close_shift", {
    p_shift_id: shiftId,
    p_closing_note: input.closingNote ?? null,
    p_user_id: sessionUser.id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const closedShiftId = Number(data ?? shiftId);
  await storeShiftCashCount(closedShiftId, Number(input.countedCash));
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

function normalizeResetSalesResult(data: unknown): SalesResetResult {
  if (!data || typeof data !== "object") {
    throw new Error("Supabase no devolvio un resultado valido al borrar ventas.");
  }

  const payload = data as {
    deleted_count?: number | string | null;
    deleted_total?: number | string | null;
    affected_shift_count?: number | string | null;
  };

  return {
    deletedCount: Number(payload.deleted_count ?? 0),
    deletedTotal: Number(payload.deleted_total ?? 0),
    affectedShiftCount: Number(payload.affected_shift_count ?? 0),
  };
}

export async function resetSalesData(input: SalesResetInput): Promise<SalesResetResult> {
  const supabase = createServiceRoleSupabaseClient();
  const startsAt = input.scope === "all" ? null : input.startsAt ?? null;
  const endsAt = input.scope === "all" ? null : input.endsAt ?? null;
  const { data, error } = await supabase.rpc("reset_sales_data", {
    p_started_at: startsAt,
    p_ended_at: endsAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeResetSalesResult(data);
}
