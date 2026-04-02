"use client";

import { useEffect, useMemo } from "react";
import { type Product } from "./db";
import { ProductSaleConfigurator } from "./ProductSaleConfigurator";
import { formatPriceLabel, formatQuantity } from "./saleUtils";

interface ProductSaleOverlayProps {
  product: Product;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
}

export function ProductSaleOverlay({
  product,
  onClose,
  onEdit,
  onDelete,
}: ProductSaleOverlayProps) {
  const blobUrl = useMemo(
    () => (product.imageBlob ? URL.createObjectURL(product.imageBlob) : null),
    [product.imageBlob],
  );
  const displayUrl = blobUrl || product.imageUrl;

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

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
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                if (product.id && confirm(`Estas seguro de eliminar "${product.name}"?`)) {
                  onDelete(product.id);
                  onClose();
                }
              }}
              className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              Eliminar
            </button>
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Categoria
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">{product.category}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Precio
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">
                    {formatPriceLabel(product)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Stock
                  </p>
                  <p className="mt-1.5 text-base font-bold text-slate-900">
                    {formatQuantity(product.stock, product.stockUnit)}
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50/50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-700">
                  {product.saleType === "weight"
                    ? `Venta por ${product.stockUnit === "liter" ? "litro" : "kilo"}`
                    : "Venta por unidad"}
                </p>
                <p className="mt-1 text-sm leading-snug text-slate-600">
                  {product.saleType === "weight"
                    ? `Podes completar por ${product.stockUnit === "liter" ? "litros" : "kilos"} o por precio, y el otro valor se calcula solo.`
                    : "Indica la cantidad de unidades para esta venta."}
                </p>
              </div>

              <ProductSaleConfigurator
                product={product}
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
