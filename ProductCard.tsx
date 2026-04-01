"use client";

import { useEffect, useMemo } from "react";
import { type Product } from "./db";
import { formatPriceLabel, formatQuantity } from "./saleUtils";

interface ProductCardProps {
  product: Product;
  isSelling: boolean;
  onToggleSale: () => void;
}

function getAdaptiveFontSize(text: string, max: number, min: number, slope: number) {
  return `${Math.max(min, max - Math.max(0, text.length - 8) * slope).toFixed(2)}px`;
}

export function ProductCard({ product, isSelling, onToggleSale }: ProductCardProps) {
  const blobUrl = useMemo(
    () => (product.imageBlob ? URL.createObjectURL(product.imageBlob) : null),
    [product.imageBlob],
  );
  const displayUrl = blobUrl || product.imageUrl;
  const priceLabel = formatPriceLabel(product);
  const stockBadgeLabel = formatQuantity(product.stock, product.stockUnit);
  const nameFontSize = getAdaptiveFontSize(product.name, 13, 9.5, 0.1);
  const priceFontSize = getAdaptiveFontSize(priceLabel, 15, 11, 0.12);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <div
      className={`group relative mx-auto aspect-square w-full max-w-[180px] cursor-pointer overflow-hidden rounded-2xl border border-blue-200/80 bg-[rgba(59,130,246,0.14)] shadow-[0_14px_30px_rgba(59,130,246,0.14)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(59,130,246,0.2)] dark:border-slate-800 dark:bg-slate-900 ${
        isSelling ? "shadow-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""
      }`}
      onClick={onToggleSale}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleSale();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex h-full flex-col p-2">
        <div
          className={`absolute right-1.5 top-1.5 z-10 rounded-lg px-1.5 py-0.5 text-[8.5px] font-bold shadow-sm transition-transform group-hover:scale-105 ${
            product.stock <= 0
              ? "bg-red-500 text-white"
              : product.stock < 5
                ? "bg-amber-500 text-white"
                : "bg-white/95 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {product.stock <= 0 ? "Sin stock" : stockBadgeLabel}
        </div>

        <div className="relative flex min-h-[7.25rem] flex-[0_0_58%] items-center justify-center overflow-hidden rounded-xl bg-white shadow-inner dark:bg-slate-800/30">
          <div className="h-full w-full p-2 transition-transform duration-500 group-hover:scale-110">
            {displayUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={displayUrl}
                alt={product.name}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            ) : (
              <span className="text-[8px] font-medium uppercase tracking-wider text-slate-400">
                Sin imagen
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-between overflow-hidden px-1 pb-1 pt-2 text-center">
          <div className="flex flex-1 items-center justify-center leading-none">
            <h3
              className="line-clamp-2 font-bold text-slate-800 dark:text-slate-100"
              style={{
                fontSize: nameFontSize,
                lineHeight: "1.1",
              }}
            >
              {product.name}
            </h3>
          </div>
          <p
            className="mt-1 shrink-0 font-black text-blue-600 dark:text-blue-400"
            style={{ fontSize: priceFontSize }}
          >
            {priceLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
