import Dexie, { Table } from "dexie";

export type SaleType = "fixed" | "weight";
export type StockUnit = "unit" | "kg";
export type PaymentMethod = "cash" | "mercado_pago" | "transfer";

export interface Product {
  id?: number;
  name: string;
  price: number;
  stock: number;
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
}

export class PetShopDatabase extends Dexie {
  products!: Table<Product>;
  cart!: Table<CartItem>;
  orders!: Table<Order>;

  constructor() {
    super("PetShopDB");

    this.version(3).stores({
      products: "++id, name, slug, category, stock",
      cart: "++id, productId",
      orders: "++id, status, createdAt",
    });

    this.version(4)
      .stores({
        products: "++id, name, slug, category, stock, saleType, stockUnit",
        cart: "++id, productId",
        orders: "++id, status, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("products").toCollection().modify((product) => {
          const nextSaleType = product.saleType ?? "fixed";
          product.saleType = nextSaleType;
          product.stockUnit = product.stockUnit ?? (nextSaleType === "weight" ? "kg" : "unit");
        });

        await tx.table("cart").toCollection().modify((item) => {
          const nextSaleType = item.saleType ?? "fixed";
          const nextStockUnit = item.stockUnit ?? (nextSaleType === "weight" ? "kg" : "unit");
          item.saleType = nextSaleType;
          item.stockUnit = nextStockUnit;
          item.step = item.step ?? (nextStockUnit === "kg" ? 0.25 : 1);
          item.category = item.category ?? "Varios";
        });

        await tx.table("orders").toCollection().modify((order) => {
          order.items = (order.items ?? []).map((item: Partial<CartItem>) => {
            const nextSaleType = item.saleType ?? "fixed";
            const nextStockUnit = item.stockUnit ?? (nextSaleType === "weight" ? "kg" : "unit");

            return {
              ...item,
              category: item.category ?? "Varios",
              saleType: nextSaleType,
              stockUnit: nextStockUnit,
              step: item.step ?? (nextStockUnit === "kg" ? 0.25 : 1),
            };
          });
        });
      });

    this.on("populate", () => {
      this.products.bulkAdd([
        {
          name: "Alimento Pro Plan Perro Adulto",
          price: 1500,
          stock: 30,
          category: "Perros",
          slug: "alimento-pro-plan-perro-adulto",
          saleType: "weight",
          stockUnit: "kg",
          description: "Venta suelta por kilo. Stock cargado en kilos disponibles.",
          lastUpdated: Date.now(),
        },
        {
          name: "Rascador para Gatos Multinivel",
          price: 25000,
          stock: 2,
          category: "Gatos",
          slug: "rascador-para-gatos-multinivel",
          saleType: "fixed",
          stockUnit: "unit",
          description: "Rascador resistente con pompones y cuevas.",
          lastUpdated: Date.now(),
        },
        {
          name: "Cucha para Perro Termica Grande",
          price: 35000,
          stock: 5,
          category: "Perros",
          slug: "cucha-perro-termica-grande",
          saleType: "fixed",
          stockUnit: "unit",
          description: "Cucha de alta resistencia ideal para exteriores.",
          lastUpdated: Date.now(),
        },
      ]);
    });
  }
}

export const db = new PetShopDatabase();
