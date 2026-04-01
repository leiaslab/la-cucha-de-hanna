import { db, type CartItem, type Order, type PaymentMethod } from "./db";

type CheckoutItem = CartItem & {
  stock?: number;
};

export async function finalizeLocalOrder({
  cartItems,
  total,
  notes,
  paymentMethod,
}: {
  cartItems: CheckoutItem[];
  total: number;
  notes?: string;
  paymentMethod: PaymentMethod;
}) {
  let printableOrder: Order | null = null;

  await db.transaction("rw", [db.products, db.orders, db.cart], async () => {
    for (const item of cartItems) {
      const product = await db.products.get(item.productId);
      if (!product) {
        throw new Error(`El producto "${item.name}" ya no existe.`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`No hay stock suficiente para "${item.name}".`);
      }

      await db.products.update(item.productId, {
        stock: product.stock - item.quantity,
      });
    }

    const orderItems: CartItem[] = cartItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      saleType: item.saleType,
      stockUnit: item.stockUnit,
      step: item.step,
    }));

    const newOrder: Order = {
      items: orderItems,
      total,
      status: "pending",
      createdAt: Date.now(),
      notes: notes?.trim() || undefined,
      paymentMethod,
    };

    const orderId = await db.orders.add(newOrder);
    printableOrder = { ...newOrder, id: Number(orderId) };
    await db.cart.clear();
  });

  return printableOrder;
}
