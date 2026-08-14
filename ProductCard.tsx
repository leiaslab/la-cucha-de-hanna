"use client";

import { memo, useEffect, useMemo } from "react";
import { type Product } from "./db";
import { formatPriceLabel, formatQuantity } from "./saleUtils";

interface ProductCardProps {
  canManageProducts?: boolean;
  isKioskMode?: boolean;
  product: Product;
  isSelling: boolean;
  onToggleSale: (productId: number) => void;
}

function getAdaptiveFontSize(text: string, max: number, min: number, slope: number) {
  return `${Math.max(min, max - Math.max(0, text.length - 8) * slope).toFixed(2)}px`;
}

export const ProductCard = memo(function ProductCard({
  canManageProducts = false,
  isKioskMode = false,
  product,
  isSelling,
  onToggleSale,
}: ProductCardProps) {
  const blobUrl = useMemo(
    () => (product.imageBlob ? URL.createObjectURL(product.imageBlob) : null),
    [product.imageBlob],
  );
  const displayUrl = blobUrl || product.imageUrl;
  const priceLabel = formatPriceLabel(product);
  const calculatedGlobalStock =
    product.localStocks && product.localStocks.length > 0
      ? product.localStocks.reduce((acc, localStock) => acc + localStock.stock, 0)
      : undefined;
  const displayedStock = canManageProducts
    ? calculatedGlobalStock ?? product.globalStock ?? product.stock
    : product.stock > 0
      ? product.stock
      : product.localStocks?.length === 1
        ? product.localStocks[0].stock
        : product.stock;
  const stockBadgeLabel = formatQuantity(displayedStock, product.stockUnit);
  const lowStockThreshold = canManageProducts
    ? product.globalLowStockAlertThreshold ?? product.lowStockAlertThreshold ?? 5
    : product.lowStockAlertThreshold ?? 5;
  const isLowStock = displayedStock > 0 && displayedStock <= lowStockThreshold;
  const nameFontSize = getAdaptiveFontSize(product.name, isKioskMode ? 13.5 : 11.5, isKioskMode ? 9.5 : 8.5, 0.12);
  const priceFontSize = getAdaptiveFontSize(priceLabel, isKioskMode ? 15.5 : 13.5, isKioskMode ? 11.5 : 10, 0.1);
  const visibleLocalStocks =
    product.localStocks
      ?.filter((localStock) => localStock.stock > 0)
      .sort((a, b) => b.stock - a.stock) ?? [];
  const stockBadgeClasses =
    displayedStock <= 0
      ? "border-red-200 bg-gradient-to-br from-red-500 via-red-500 to-rose-600 text-white shadow-[0_14px_28px_rgba(239,68,68,0.35)]"
      : isLowStock
        ? "border-amber-200 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white shadow-[0_14px_28px_rgba(245,158,11,0.35)]"
        : "border-emerald-200 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 text-white shadow-[0_14px_28px_rgba(16,185,129,0.3)]";

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <div
      className={`product-card group relative mx-auto w-full cursor-pointer overflow-hidden border border-blue-200/80 bg-[rgba(59,130,246,0.14)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(59,130,246,0.2)] dark:border-slate-800 dark:bg-slate-900 ${
        isKioskMode
          ? "max-w-[220px] rounded-[1.75rem] shadow-[0_18px_34px_rgba(59,130,246,0.18)]"
          : "max-w-[188px] rounded-[1.5rem] shadow-[0_14px_30px_rgba(59,130,246,0.14)]"
      } ${
        isSelling ? "shadow-md ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900" : ""
      }`}
      onClick={() => product.id && onToggleSale(product.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (product.id) {
            onToggleSale(product.id);
          }
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={`flex flex-col ${isKioskMode ? "gap-2 p-2" : "gap-1.5 p-1.5"}`}>
        <div
          className={`absolute right-2 top-2 z-10 flex items-center gap-1.5 border font-bold tracking-[0.02em] transition-transform group-hover:scale-105 ${
            isKioskMode ? "rounded-[1rem] px-3 py-2" : "rounded-[0.95rem] px-2.5 py-1.5"
          } ${stockBadgeClasses}`}
          title={canManageProducts ? "Stock global" : "Stock del local"}
        >
          <span className={`${isKioskMode ? "text-[9px]" : "text-[8px]"} uppercase tracking-[0.18em] text-white/80`}>
            Stock
          </span>
          <span className={`${isKioskMode ? "text-[11px]" : "text-[10px]"} font-black leading-none`}>
            {displayedStock <= 0 ? "Sin stock" : stockBadgeLabel}
          </span>
        </div>

        <div
          className={`relative flex items-center justify-center overflow-hidden bg-white shadow-inner dark:bg-slate-800/30 ${
            isKioskMode ? "min-h-[11.5rem] rounded-[1.25rem]" : "min-h-[10rem] rounded-[1.05rem]"
          }`}
        >
          <div
            className={`flex items-center justify-center p-2 transition-transform duration-500 group-hover:scale-110 ${
              isKioskMode ? "h-[10.8rem] w-[10.8rem]" : "h-[9.45rem] w-[9.45rem]"
            }`}
          >
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

        <div
          className={`flex flex-col justify-center border border-white/40 bg-white/60 text-center dark:border-slate-700 dark:bg-slate-800/45 ${
            isKioskMode ? "min-h-[3.4rem] rounded-[1.2rem] px-3 pb-2 pt-2" : "min-h-[2.55rem] rounded-[1rem] px-2 pb-1.5 pt-1.5"
          }`}
        >
          <div className={`flex items-center justify-center ${isKioskMode ? "min-h-[1.9rem]" : "min-h-[1.55rem]"}`}>
            <h3
              className="line-clamp-2 pb-[0.15rem] font-bold text-slate-800 dark:text-slate-100"
              style={{
                fontSize: nameFontSize,
                lineHeight: "1.2",
              }}
            >
              {product.name}
            </h3>
          </div>
          <p
            className="mt-0 shrink-0 font-black text-blue-600 dark:text-blue-400"
            style={{ fontSize: priceFontSize, lineHeight: "1.05" }}
          >
            {priceLabel}
          </p>
          {product.code && (
            <p className="mt-1 truncate font-mono text-[9px] font-semibold text-slate-500 dark:text-slate-400">
              Cod. {product.code}
            </p>
          )}
          {canManageProducts && visibleLocalStocks.length > 0 && (
            <div className={`mt-1 flex flex-wrap justify-center ${isKioskMode ? "gap-1.5" : "gap-1"}`}>
              {visibleLocalStocks.map((localStock) => (
                <span
                  key={localStock.localId}
                  className={`rounded-full border px-2 py-1 text-[9px] font-bold shadow-sm ${
                    localStock.stock <= 0
                      ? "border-red-200 bg-red-100 text-red-700"
                      : localStock.stock <= (localStock.lowStockAlertThreshold ?? 5)
                        ? "border-amber-200 bg-amber-100 text-amber-800"
                        : "border-emerald-200 bg-emerald-100 text-emerald-800"
                  }`}
                  title={`${localStock.localName}: ${formatQuantity(localStock.stock, product.stockUnit)}`}
                >
                  {localStock.localName}: {formatQuantity(localStock.stock, product.stockUnit)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
