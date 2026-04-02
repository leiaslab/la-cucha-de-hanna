"use client";

import { useMemo, useState } from "react";
import { db, type Product } from "./db";
import {
  calculateAmountFromQuantity,
  calculateQuantityFromAmount,
  canSellQuantity,
  formatQuantity,
  getQuantityStep,
  roundQuantity,
} from "./saleUtils";
import { showToast } from "./Toast";

type WeightInputMode = "quantity" | "amount";

interface ProductSaleConfiguratorProps {
  product: Product;
  compact?: boolean;
  onCancel?: () => void;
  onAdded?: () => void;
}

export function ProductSaleConfigurator({
  product,
  compact = false,
  onCancel,
  onAdded,
}: ProductSaleConfiguratorProps) {
  const [quantityInput, setQuantityInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [unitQuantityInput, setUnitQuantityInput] = useState("1");
  const [lastEditedWeightField, setLastEditedWeightField] = useState<WeightInputMode>("quantity");

  const quantityStep = getQuantityStep(product.stockUnit);

  const weightSale = useMemo(() => {
    if (lastEditedWeightField === "amount") {
      const nextAmount = Number(amountInput || 0);
      const nextQuantity = calculateQuantityFromAmount(nextAmount, product.price);
      return {
        quantity: nextQuantity,
        total: roundQuantity(nextAmount),
      };
    }

    const nextQuantity = roundQuantity(Number(quantityInput || 0));
    const nextAmount = calculateAmountFromQuantity(nextQuantity, product.price);
    return {
      quantity: nextQuantity,
      total: nextAmount,
    };
  }, [amountInput, lastEditedWeightField, product.price, quantityInput]);

  const fixedQuantity = Math.max(0, Math.floor(Number(unitQuantityInput || 0)));
  const selectedQuantity = product.saleType === "weight" ? weightSale.quantity : fixedQuantity;
  const selectedTotal =
    product.saleType === "weight"
      ? weightSale.total
      : roundQuantity(product.price * fixedQuantity);
  const displayedQuantityInput =
    product.saleType === "weight"
      ? lastEditedWeightField === "amount"
        ? amountInput === ""
          ? ""
          : String(weightSale.quantity)
        : quantityInput
      : unitQuantityInput;
  const displayedAmountInput =
    product.saleType === "weight"
      ? lastEditedWeightField === "quantity"
        ? quantityInput === ""
          ? ""
          : String(weightSale.total)
        : amountInput
      : "";
  const remainingStock = Math.max(0, roundQuantity(product.stock - selectedQuantity));
  const canAddToCart =
    selectedQuantity > 0 &&
    selectedTotal > 0 &&
    canSellQuantity(product.stock, selectedQuantity, product.stockUnit);

  const handleAddToCart = async () => {
    if (!product.id || !canAddToCart) {
      showToast("La cantidad elegida no es valida para el stock disponible.", "error");
      return;
    }

    const existing = await db.cart.where("productId").equals(product.id).first();
    const nextQuantity = roundQuantity((existing?.quantity || 0) + selectedQuantity);

    if (!canSellQuantity(product.stock, nextQuantity, product.stockUnit)) {
      showToast("No hay stock suficiente para agregar esa cantidad al carrito.", "error");
      return;
    }

    if (existing?.id) {
      await db.cart.update(existing.id, { quantity: nextQuantity });
    } else {
      await db.cart.add({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: selectedQuantity,
        category: product.category,
        saleType: product.saleType,
        stockUnit: product.stockUnit,
        step: quantityStep,
      });
    }

    if (product.saleType === "weight") {
      setQuantityInput("");
      setAmountInput("");
      setLastEditedWeightField("quantity");
    } else {
      setUnitQuantityInput("1");
    }

    showToast("Producto agregado al carrito.", "success");
    onAdded?.();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleAddToCart();
  };

  const wrapperClassName = compact
    ? "flex h-full flex-col space-y-2.5 rounded-[1.4rem] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
    : "space-y-4 rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)]";
  const inputClassName = compact
    ? "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
    : "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white";
  const labelClassName =
    "block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
  const totalValueClassName = compact
    ? "text-2xl font-black tracking-tight text-slate-900"
    : "text-4xl font-black tracking-tight text-slate-900";

  const quantityPreview =
    product.saleType === "weight"
      ? formatQuantity(selectedQuantity, product.stockUnit)
      : `${Math.round(selectedQuantity || 0).toLocaleString("es-AR")} un`;
  const quantityLabel = product.stockUnit === "liter" ? "Litros" : "Kilos";

  return (
    <form className={wrapperClassName} onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
      {product.saleType === "weight" ? (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label htmlFor={`weight-quantity-${product.id}`} className={labelClassName}>
              {quantityLabel}
            </label>
            <input
              id={`weight-quantity-${product.id}`}
              type="number"
              min="0"
              step="0.25"
              value={displayedQuantityInput}
              onChange={(event) => {
                setLastEditedWeightField("quantity");
                setQuantityInput(event.target.value);
              }}
              className={inputClassName}
              placeholder="Ej: 1.5"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`weight-amount-${product.id}`} className={labelClassName}>
              Precio
            </label>
            <input
              id={`weight-amount-${product.id}`}
              type="number"
              min="0"
              step="0.01"
              value={displayedAmountInput}
              onChange={(event) => {
                setLastEditedWeightField("amount");
                setAmountInput(event.target.value);
              }}
              className={inputClassName}
              placeholder="Ej: 1000"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label htmlFor={`unit-quantity-${product.id}`} className={labelClassName}>
              Unidad
            </label>
            <input
              id={`unit-quantity-${product.id}`}
              type="number"
              min="1"
              step="1"
              value={unitQuantityInput}
              onChange={(event) => setUnitQuantityInput(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>
      )}

      <div
        className={`rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 ${
          compact ? "py-2.5" : "py-3"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Total
        </p>
        <p className={totalValueClassName}>${selectedTotal.toLocaleString("es-AR")}</p>
        <div
          className={`flex items-center justify-between text-xs text-slate-500 ${
            compact ? "mt-1.5" : "mt-2"
          }`}
        >
          <span>Cantidad: {quantityPreview}</span>
          <span>Stock: {formatQuantity(remainingStock, product.stockUnit)}</span>
        </div>
      </div>

      {!canAddToCart && selectedQuantity > 0 && (
        <p className="text-xs font-medium text-red-600">
          La cantidad elegida supera el stock disponible.
        </p>
      )}

      <div className={`flex flex-col gap-2 ${compact ? "mt-auto" : ""}`}>
        <button
          type="submit"
          disabled={!canAddToCart}
          className={`w-full rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${
            compact ? "py-2.5" : "py-3"
          }`}
        >
          Agregar al carrito
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-xl px-3 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 ${
              compact ? "py-1" : "py-1.5"
            }`}
          >
            Cerrar
          </button>
        )}
      </div>
    </form>
  );
}
