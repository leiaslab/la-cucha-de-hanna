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
  const isLowStock = product.stock > 0 && product.stock <= (product.lowStockAlertThreshold ?? 5);
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
      className={`group relative mx-auto aspect-[4/5.3] w-full max-w-[188px] cursor-pointer overflow-hidden rounded-[1.5rem] border border-blue-200/80 bg-[rgba(59,130,246,0.14)] shadow-[0_14px_30px_rgba(59,130,246,0.14)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(59,130,246,0.2)] dark:border-slate-800 dark:bg-slate-900 ${
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
      <div className="flex h-full flex-col p-2.5">
        <div
          className={`absolute right-2 top-2 z-10 rounded-full px-2 py-1 text-[9px] font-bold shadow-sm transition-transform group-hover:scale-105 ${
            product.stock <= 0
              ? "bg-red-500 text-white"
              : isLowStock
                ? "bg-amber-500 text-white"
                : "bg-white/95 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {product.stock <= 0 ? "Sin stock" : stockBadgeLabel}
        </div>

        <div className="relative flex min-h-[7.75rem] flex-[0_0_56%] items-center justify-center overflow-hidden rounded-[1.15rem] bg-white shadow-inner dark:bg-slate-800/30">
          <div className="h-full w-full p-2.5 transition-transform duration-500 group-hover:scale-110">
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

        <div className="mt-2 flex flex-1 flex-col justify-between rounded-[1.05rem] border border-white/40 bg-white/60 px-2.5 pb-2.5 pt-2 text-center dark:border-slate-700 dark:bg-slate-800/45">
          <div className="flex min-h-[3.2rem] items-center justify-center leading-none">
            <h3
              className="line-clamp-3 font-bold text-slate-800 dark:text-slate-100"
              style={{
                fontSize: nameFontSize,
                lineHeight: "1.15",
              }}
            >
              {product.name}
            </h3>
          </div>
          <p
            className="mt-2 min-h-[2.2rem] shrink-0 font-black text-blue-600 dark:text-blue-400"
            style={{ fontSize: priceFontSize, lineHeight: "1.15" }}
          >
            {priceLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
