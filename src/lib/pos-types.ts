export type SaleType = "fixed" | "weight";
export type StockUnit = "unit" | "kg" | "liter";
export type PaymentMethod = "cash" | "mercado_pago" | "transfer";
export type ShiftStatus = "open" | "closed";
export type AppRole = "admin" | "cajero";

export interface LocalRecord {
  id: number;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Product {
  id?: number;
  name: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAlertThreshold: number;
  category: string;
  slug: string;
  saleType: SaleType;
  stockUnit: StockUnit;
  description?: string;
  imageUrl?: string;
  imageBlob?: Blob;
  lastUpdated: number;
}

export interface CartItem {
  id?: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  category: string;
  saleType: SaleType;
  stockUnit: StockUnit;
  step: number;
}

export interface Order {
  id?: number;
  items: CartItem[];
  total: number;
  status: "pending" | "synced";
  createdAt: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  shiftId?: number;
  clientId?: number;
  userId?: number;
  localId?: number;
  userFullName?: string;
  localName?: string;
}

export interface Shift {
  id?: number;
  status: ShiftStatus;
  openedAt: number;
  openingCash: number;
  openingNote?: string;
  closedAt?: number;
  closingNote?: string;
  orderCount?: number;
  totalSales?: number;
  cashSales?: number;
  mercadoPagoSales?: number;
  transferSales?: number;
  expectedCash?: number;
  openedByUserId?: number;
  closedByUserId?: number;
  localId?: number;
  localName?: string;
}

export interface SessionUser {
  id: number | null;
  username: string;
  fullName: string;
  role: AppRole;
  localId?: number | null;
  localName?: string;
  source: "database" | "fallback";
}

export interface AppUser {
  id: number;
  fullName: string;
  username: string;
  role: AppRole;
  isActive: boolean;
  localeId?: number;
  localeName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppUserInput {
  fullName: string;
  username: string;
  password: string;
  role: AppRole;
  localeName: string;
}

export interface AppUserUpdateInput {
  fullName?: string;
  username?: string;
  password?: string;
  role?: AppRole;
  isActive?: boolean;
  localeName?: string;
}

export interface ClientRecord {
  id?: number;
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PdfRecord {
  id?: number;
  entityType: "sale" | "shift";
  entityId: number;
  fileName: string;
  driveFileId: string;
  driveUrl: string;
  mimeType: string;
  createdAt: number;
}

export interface RemoteSnapshot {
  products: Product[];
  orders: Order[];
  shifts: Shift[];
  clients: ClientRecord[];
  pdfs: PdfRecord[];
}

export interface ProductInput {
  name: string;
  price: number;
  cost: number;
  stock: number;
  lowStockAlertThreshold: number;
  category: string;
  slug: string;
  saleType: SaleType;
  stockUnit: StockUnit;
  description?: string;
  imageUrl?: string;
  lastUpdated?: number;
}

export interface CheckoutPayload {
  cartItems: CartItem[];
  total: number;
  notes?: string;
  paymentMethod: PaymentMethod;
  clientId?: number | null;
  generatePdf?: boolean;
}

export interface CheckoutResult {
  order: Order;
  updatedProducts: Product[];
  shift?: Shift | null;
  pdf?: PdfGenerationResult | null;
}

export interface ShiftOpenInput {
  openingCash: number;
  openingNote?: string;
}

export interface ShiftCloseInput {
  closingNote?: string;
  generatePdf?: boolean;
}

export interface PdfGenerationResult {
  record: PdfRecord;
  base64: string;
}
