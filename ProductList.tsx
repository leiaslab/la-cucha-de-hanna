"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
}

export function ProductList({
  canManageProducts = false,
  onEditProduct,
  extraControls,
  leadingContent,
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeSaleProductId, setActiveSaleProductId] = useState<number | null>(null);
  const warnedStockRef = useRef(new Set<string>());

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

  const filteredProducts = useLiveQuery(async () => {
    const query = selectedCategory 
      ? db.products.where("category").equals(selectedCategory)
      : db.products.toCollection();

    const products = await query.toArray();
    const normalizedSearch = searchTerm.trim().toLowerCase();
    
    if (!normalizedSearch) return products;

    return products.filter((p) => 
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.description?.toLowerCase().includes(normalizedSearch) ||
      p.category.toLowerCase().includes(normalizedSearch)
    );
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    if (!allProductsForCategories) {
      return;
    }

    allProductsForCategories.forEach((product) => {
      const visibleStock = canManageProducts ? product.globalStock ?? product.stock : product.stock;
      const threshold = Math.max(
        0,
        canManageProducts
          ? product.globalLowStockAlertThreshold ?? product.lowStockAlertThreshold ?? 5
          : product.lowStockAlertThreshold ?? 5,
      );
      if (visibleStock > threshold) {
        return;
      }

      const warningKey = `${product.id}-${visibleStock}`;
      if (warnedStockRef.current.has(warningKey)) {
        return;
      }

      warnedStockRef.current.add(warningKey);
      showToast(
        `Alerta de stock: ${product.name} llego a ${visibleStock.toLocaleString("es-AR")} ${product.stockUnit === "unit" ? "un" : product.stockUnit === "liter" ? "l" : "kg"}.`,
        "warning",
      );
    });
  }, [allProductsForCategories, canManageProducts]);

  const handleDelete = async (id: number) => {
    try {
      await deleteProductRemote(id);
      showToast("Producto eliminado correctamente.", "success");
    } catch {
      showToast("Error al eliminar el producto.", "error");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="relative shrink-0">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:gap-5">
          {leadingContent && <div className="shrink-0 xl:self-end">{leadingContent}</div>}
          <select
            value={selectedCategory ?? ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="appearance-none rounded-full border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none shadow-[0_10px_25px_rgba(15,23,42,0.06)] transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 xl:w-40"
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
          <input
            type="text"
            placeholder="Buscar productos"
            className="w-full min-w-0 rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {extraControls && <div className="shrink-0 xl:self-end">{extraControls}</div>}
        </div>
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto xl:pr-1">
        {filteredProducts === undefined ? (
          <p className="py-10 text-center text-slate-500 dark:text-slate-300">Cargando catalogo local...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="py-10 text-center text-slate-500 dark:text-slate-300">
            No se encontraron productos para &quot;{searchTerm}&quot;
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                canManageProducts={canManageProducts}
                product={product}
                isSelling={activeSaleProductId === product.id}
                onToggleSale={() =>
                  setActiveSaleProductId((current) => (current === product.id ? null : product.id ?? null))
                }
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
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </div>
  );
}
