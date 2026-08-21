"use client";

import { useEffect, useMemo, useState } from "react";
import { type Product } from "./db";
import { ProductSaleConfigurator } from "./ProductSaleConfigurator";
import { formatPriceLabel, formatQuantity, isQuickSaleProduct } from "./saleUtils";

interface ProductSaleOverlayProps {
  canManageProducts?: boolean;
  stockControlEnabled?: boolean;
  product: Product;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => Promise<void>;
}

export function ProductSaleOverlay({
  canManageProducts = false,
  stockControlEnabled = true,
  product,
  onClose,
  onEdit,
  onDelete,
}: ProductSaleOverlayProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const blobUrl = useMemo(
    () => (product.imageBlob ? URL.createObjectURL(product.imageBlob) : null),
    [product.imageBlob],
  );
  const displayUrl = blobUrl || product.imageUrl;
  const isQuickSale = isQuickSaleProduct(product);
  const isFreePriceSale = isQuickSale || !stockControlEnabled;
  const globalStock = product.globalStock ?? product.stock;
  const visibleLocalStocks =
    product.localStocks
      ?.filter((localStock) => localStock.stock > 0)
      .sort((a, b) => b.stock - a.stock) ?? [];

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (isFreePriceSale) {
    return (
      <div
        className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.35)] sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                {isQuickSale ? "Venta rápida" : "Venta de producto"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">
                {isQuickSale ? "Ingresá el importe" : product.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isQuickSale
                  ? "Después podrás elegir el medio de pago habitual."
                  : `Precio de referencia: ${formatPriceLabel(product)}. Ingresá el importe que vas a cobrar.`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>

          <ProductSaleConfigurator
            product={product}
            stockControlEnabled={stockControlEnabled}
            freePriceMode={!stockControlEnabled}
            onCancel={onClose}
            onAdded={onClose}
          />

          {canManageProducts && (
            <div className="mt-4 flex justify-center gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (product.id && confirm(`¿Eliminar "${product.name}"?`)) {
                    try {
                      setIsDeleting(true);
                      await onDelete(product.id);
                      onClose();
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Borrando..." : "Eliminar"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-screen items-stretch justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex h-screen w-full flex-col bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Venta de producto
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900 sm:text-[2rem]">
              {product.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {canManageProducts && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (product.id && confirm(`Estas seguro de eliminar "${product.name}"?`)) {
                      try {
                        setIsDeleting(true);
                        await onDelete(product.id);
                        onClose();
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                >
                  {isDeleting ? "Borrando..." : "Eliminar"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-4 xl:overflow-hidden">
          <div className="grid gap-4 xl:h-full xl:grid-cols-[minmax(280px,390px)_minmax(320px,1fr)]">
            <section className="space-y-3">
              <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                {displayUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={displayUrl}
                    alt={product.name}
                    className="h-auto max-h-[42vh] w-full object-contain xl:max-h-[44vh]"
                  />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center text-slate-400 xl:min-h-[280px]">
                    Sin imagen
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Categoria
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">
                    {product.category}
                    {product.subcategory ? ` / ${product.subcategory}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Precio
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">
                    {formatPriceLabel(product)}
                  </p>
                </div>
                {stockControlEnabled && product.saleType !== "variable" && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {canManageProducts ? "Stock del local" : "Stock"}
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">
                    {formatQuantity(product.stock, product.stockUnit)}
                  </p>
                </div>}
                {stockControlEnabled && canManageProducts && product.saleType !== "variable" && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Stock global
                    </p>
                    <p className="mt-1.5 text-base font-bold text-slate-900">
                      {formatQuantity(globalStock, product.stockUnit)}
                    </p>
                  </div>
                )}
              </div>

              {stockControlEnabled && canManageProducts && product.saleType !== "variable" && visibleLocalStocks.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Stock por local
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibleLocalStocks.map((localStock) => (
                      <span
                        key={localStock.localId}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          localStock.stock <= 0
                            ? "bg-red-100 text-red-700"
                            : localStock.stock <= (localStock.lowStockAlertThreshold ?? 5)
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {localStock.localName}: {formatQuantity(localStock.stock, product.stockUnit)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              {product.description?.trim() && (
                <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800">Comentarios del producto</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-slate-700">
                    {product.description}
                  </p>
                </div>
              )}

              <ProductSaleConfigurator
                product={product}
                stockControlEnabled={stockControlEnabled}
                compact
                onCancel={onClose}
                onAdded={onClose}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
