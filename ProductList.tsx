"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product } from "./db";
import { ProductCard } from "./ProductCard";
import { ProductSaleOverlay } from "./ProductSaleOverlay";
import { deleteProductRemote } from "./src/lib/api-client";
import { showToast } from "./Toast";

interface ProductListProps {
  canManageProducts?: boolean;
  onEditProduct: (product: Product) => void;
  extraControls?: ReactNode;
  leadingContent?: ReactNode;
  isKioskMode?: boolean;
  isTouchOptimized?: boolean;
}

export function ProductList({
  canManageProducts = false,
  onEditProduct,
  extraControls,
  leadingContent,
  isKioskMode = false,
  isTouchOptimized = false,
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [activeSaleProductId, setActiveSaleProductId] = useState<number | null>(null);
  const lowStockSummaryRef = useRef<string | null>(null);

  const allProductsForCategories = useLiveQuery(() => db.products.toArray());
  const activeSaleProduct = useLiveQuery(
    () => (activeSaleProductId === null ? undefined : db.products.get(activeSaleProductId)),
    [activeSaleProductId],
  );

  const uniqueCategories = useMemo(() => {
    if (!allProductsForCategories) {
      return [];
    }
    return Array.from(new Set(allProductsForCategories.map((p) => p.category))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [allProductsForCategories]);

  const uniqueSubcategories = useMemo(() => {
    if (!allProductsForCategories || !selectedCategory) {
      return [];
    }

    return Array.from(
      new Set(
        allProductsForCategories
          .filter((product) => product.category === selectedCategory)
          .map((product) => product.subcategory?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [allProductsForCategories, selectedCategory]);

  const filteredProducts = useLiveQuery(async () => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const products = normalizedSearch
      ? await db.products.toArray()
      : await (selectedCategory
          ? db.products.where("category").equals(selectedCategory)
          : db.products.toCollection()
        ).toArray();

    const productsInSubcategory = selectedSubcategory
      ? normalizedSearch
        ? products
        : products.filter((product) => product.subcategory === selectedSubcategory)
      : products;
    const visibleProducts = normalizedSearch
      ? productsInSubcategory.filter((p) =>
          p.code?.toLowerCase().includes(normalizedSearch) ||
          p.name.toLowerCase().includes(normalizedSearch),
        )
      : productsInSubcategory;

    return visibleProducts.sort((a, b) => {
      const categoryOrder = a.category.localeCompare(b.category, "es", { sensitivity: "base" });
      if (categoryOrder !== 0) {
        return categoryOrder;
      }

      const subcategoryOrder = (a.subcategory ?? "").localeCompare(b.subcategory ?? "", "es", {
        sensitivity: "base",
      });
      if (subcategoryOrder !== 0) {
        return subcategoryOrder;
      }

      const priceOrder = a.price - b.price;
      return priceOrder !== 0
        ? priceOrder
        : a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });
  }, [searchTerm, selectedCategory, selectedSubcategory]);

  useEffect(() => {
    if (!allProductsForCategories) {
      return;
    }

    const lowStockProducts = allProductsForCategories.filter((product) => {
      const visibleStock = canManageProducts ? product.globalStock ?? product.stock : product.stock;
      const threshold = Math.max(
        0,
        canManageProducts
          ? product.globalLowStockAlertThreshold ?? product.lowStockAlertThreshold ?? 5
          : product.lowStockAlertThreshold ?? 5,
      );

      return visibleStock <= threshold;
    });

    const summaryKey = lowStockProducts
      .map((product) => `${product.id}:${canManageProducts ? product.globalStock ?? product.stock : product.stock}`)
      .sort()
      .join("|");

    if (!summaryKey || lowStockSummaryRef.current === summaryKey) {
      return;
    }

    lowStockSummaryRef.current = summaryKey;
    showToast(
      lowStockProducts.length === 1
        ? `Stock bajo en 1 producto. Revisa "Reporte stock".`
        : `Stock bajo en ${lowStockProducts.length} productos. Revisa "Reporte stock".`,
      "warning",
    );
  }, [allProductsForCategories, canManageProducts]);

  const handleDelete = async (id: number) => {
    try {
      await deleteProductRemote(id);
      showToast("Producto eliminado correctamente.", "success");
    } catch {
      showToast("Error al eliminar el producto.", "error");
    }
  };

  const handleToggleSale = useCallback((productId: number) => {
    setActiveSaleProductId((current) => (current === productId ? null : productId));
  }, []);

  return (
    <div className={`flex h-full min-h-0 flex-col ${isKioskMode ? "gap-3 lg:gap-4" : "gap-4 md:gap-6"}`}>
      <div
        className={`relative z-20 shrink-0 ${
          isKioskMode
            ? ""
            : "sticky top-0 -mx-2 rounded-[1.6rem] bg-white/96 px-2 pb-3 pt-1 backdrop-blur dark:bg-slate-900/96 sm:-mx-3 sm:px-3"
        }`}
      >
        <div
          className={`flex flex-col ${
            isKioskMode ? "gap-3 lg:flex-row lg:items-end lg:gap-4" : "gap-3 xl:flex-row xl:items-end xl:gap-5"
          }`}
        >
          {leadingContent && (
            <div className={`${isKioskMode ? "lg:min-w-[18rem] lg:self-end" : "shrink-0 xl:self-end"}`}>
              {leadingContent}
            </div>
          )}
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => {
              setSelectedCategory(e.target.value || null);
              setSelectedSubcategory(null);
            }}
            className={`appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-10 font-semibold text-slate-700 outline-none shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${
              isKioskMode
                ? "touch-target py-3.5 text-base lg:w-44"
                : "touch-target py-3 text-sm xl:w-40"
            }`}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
              backgroundPosition: "right 0.9rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1rem",
            }}
          >
            <option value="">Todas</option>
            {uniqueCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={selectedSubcategory ?? ""}
            onChange={(e) => setSelectedSubcategory(e.target.value || null)}
            disabled={!selectedCategory || uniqueSubcategories.length === 0}
            className={`appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-10 font-semibold text-slate-700 outline-none shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 ${
              isKioskMode ? "touch-target py-3.5 text-base lg:w-48" : "touch-target py-3 text-sm xl:w-44"
            }`}
          >
            <option value="">Todas las subcategorias</option>
            {uniqueSubcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Buscar por nombre o codigo"
            className={`w-full min-w-0 rounded-full border border-slate-200 bg-white px-5 text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 ${
              isKioskMode || isTouchOptimized ? "touch-target py-3.5 text-base text-left" : "py-3 text-center"
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              const normalizedCode = searchTerm.trim().toLowerCase();
              const exactProduct = allProductsForCategories?.find(
                (product) => product.code?.trim().toLowerCase() === normalizedCode,
              );

              if (exactProduct?.id) {
                setActiveSaleProductId(exactProduct.id);
              }
            }}
          />
          {extraControls && (
            <div className={`${isKioskMode ? "lg:self-end" : "shrink-0 xl:self-end"}`}>
              {extraControls}
            </div>
          )}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${isKioskMode ? "lg:pr-1" : "pr-1 xl:pr-1"}`}>
        {filteredProducts === undefined ? (
          <p className="py-10 text-center text-slate-500 dark:text-slate-300">Cargando catalogo local...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="py-10 text-center text-slate-500 dark:text-slate-300">
            No se encontraron productos para &quot;{searchTerm}&quot;
          </p>
        ) : (
          <div
            className={`grid grid-cols-2 ${
              isKioskMode
                ? "gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                : "gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            }`}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                canManageProducts={canManageProducts}
                isKioskMode={isKioskMode}
                product={product}
                isSelling={activeSaleProductId === product.id}
                onToggleSale={handleToggleSale}
              />
            ))}
          </div>
        )}
      </div>

      {activeSaleProduct && (
        <ProductSaleOverlay
          canManageProducts={canManageProducts}
          product={activeSaleProduct}
          onClose={() => setActiveSaleProductId(null)}
          onEdit={(product) => {
            setActiveSaleProductId(null);
            onEditProduct(product);
          }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
