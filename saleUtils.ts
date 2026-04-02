import type { CartItem, Product, SaleType, StockUnit } from "./db";

export function getQuantityStep(stockUnit: StockUnit) {
  return stockUnit === "unit" ? 1 : 0.25;
}

export function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}

export function formatQuantity(value: number, stockUnit: StockUnit) {
  if (stockUnit === "kg" || stockUnit === "liter") {
    return `${roundQuantity(value).toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} ${stockUnit === "kg" ? "kg" : "l"}`;
  }

  return `${Math.round(value).toLocaleString("es-AR")} un`;
}

export function formatPriceLabel(product: Pick<Product, "price" | "saleType" | "stockUnit">) {
  return product.saleType === "weight"
    ? `$${product.price.toLocaleString("es-AR")} / ${product.stockUnit === "liter" ? "l" : "kg"}`
    : `$${product.price.toLocaleString("es-AR")}`;
}

export function getSaleTypeLabel(saleType: SaleType, stockUnit: StockUnit) {
  if (saleType !== "weight") {
    return "Precio fijo";
  }

  return stockUnit === "liter" ? "Por litro" : "Por kilo";
}

export function calculateQuantityFromAmount(amount: number, pricePerKg: number) {
  if (!pricePerKg || amount <= 0) {
    return 0;
  }

  return roundQuantity(amount / pricePerKg);
}

export function calculateAmountFromQuantity(quantity: number, pricePerKg: number) {
  if (!pricePerKg || quantity <= 0) {
    return 0;
  }

  return roundQuantity(quantity * pricePerKg);
}

export function getLineTotal(item: Pick<CartItem, "price" | "quantity">) {
  return roundQuantity(item.price * item.quantity);
}

export function canSellQuantity(
  stock: number,
  quantity: number,
  stockUnit: StockUnit,
) {
  if (quantity <= 0) {
    return false;
  }

  if (stockUnit === "kg" || stockUnit === "liter") {
    return quantity <= roundQuantity(stock);
  }

  return quantity <= Math.floor(stock);
}

export function getRemainingStockLabel(product: Pick<Product, "stock" | "stockUnit">) {
  return formatQuantity(product.stock, product.stockUnit);
}
