import Dexie, { Table } from "dexie";
import type { CartItem, Order, Product, Shift } from "./src/lib/pos-types";

export type {
  CartItem,
  ClientRecord,
  Order,
  PaymentMethod,
  PdfRecord,
  Product,
  SaleType,
  Shift,
  ShiftStatus,
  StockUnit,
} from "./src/lib/pos-types";

export class PetShopDatabase extends Dexie {
  products!: Table<Product>;
  cart!: Table<CartItem>;
  orders!: Table<Order>;
  shifts!: Table<Shift>;

  constructor() {
    super("PetShopDB");

    this.version(3).stores({
      products: "++id, name, slug, category, stock",
      cart: "++id, productId",
      orders: "++id, status, createdAt",
      shifts: "++id, status, openedAt, closedAt",
    });

    this.version(4)
      .stores({
        products: "++id, name, slug, category, stock, saleType, stockUnit",
        cart: "++id, productId",
        orders: "++id, status, createdAt",
        shifts: "++id, status, openedAt, closedAt",
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
          item.step = item.step ?? (nextStockUnit === "unit" ? 1 : 0.25);
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
              step: item.step ?? (nextStockUnit === "unit" ? 1 : 0.25),
            };
          });
        });
      });

    this.version(5)
      .stores({
        products: "++id, name, slug, category, stock, saleType, stockUnit, cost",
        cart: "++id, productId",
        orders: "++id, status, createdAt",
        shifts: "++id, status, openedAt, closedAt",
      })
      .upgrade(async (tx) => {
        await tx.table("products").toCollection().modify((product) => {
          product.cost = product.cost ?? product.price ?? 0;
        });
      });

    this.version(6)
      .stores({
        products: "++id, name, slug, category, stock, saleType, stockUnit, cost, lowStockAlertThreshold",
        cart: "++id, productId",
        orders: "++id, status, createdAt",
        shifts: "++id, status, openedAt, closedAt",
      })
      .upgrade(async (tx) => {
        await tx.table("products").toCollection().modify((product) => {
          product.lowStockAlertThreshold = product.lowStockAlertThreshold ?? 5;
        });
      });

    this.version(7)
      .stores({
        products: "++id, name, slug, category, stock, saleType, stockUnit, cost, lowStockAlertThreshold",
        cart: "++id, productId",
        orders: "++id, status, createdAt, shiftId",
        shifts: "++id, status, openedAt, closedAt",
      })
      .upgrade(async (tx) => {
        await tx.table("orders").toCollection().modify((order) => {
          order.shiftId = order.shiftId ?? undefined;
        });
      });

    this.on("populate", () => {
      this.products.bulkAdd([
        {
          name: "Alimento Pro Plan Perro Adulto",
          price: 1500,
          cost: 1050,
          stock: 30,
          lowStockAlertThreshold: 5,
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
          cost: 18000,
          stock: 2,
          lowStockAlertThreshold: 2,
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
          cost: 25000,
          stock: 5,
          lowStockAlertThreshold: 1,
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
