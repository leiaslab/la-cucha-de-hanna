"use client";

import { db } from "../../db";
import type { LocalRecord, Order, Product, RemoteSnapshot, Shift } from "./pos-types";

async function replaceTableData<T extends { id?: number }>(
  clear: () => Promise<void>,
  bulkPut: (items: T[]) => Promise<unknown>,
  items: T[],
) {
  await clear();
  if (items.length > 0) {
    await bulkPut(items);
  }
}

export async function hydrateRemoteSnapshot(snapshot: RemoteSnapshot) {
  await db.transaction("rw", [db.locals, db.products, db.orders, db.shifts], async () => {
    await replaceTableData<LocalRecord>(() => db.locals.clear(), (items) => db.locals.bulkPut(items), snapshot.locales);
    await replaceTableData<Product>(() => db.products.clear(), (items) => db.products.bulkPut(items), snapshot.products);
    await replaceTableData<Order>(() => db.orders.clear(), (items) => db.orders.bulkPut(items), snapshot.orders);
    await replaceTableData<Shift>(() => db.shifts.clear(), (items) => db.shifts.bulkPut(items), snapshot.shifts);
  });
}
