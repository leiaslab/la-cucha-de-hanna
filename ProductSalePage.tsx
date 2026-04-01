"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo } from "react";
import { db } from "./db";
import { ProductSaleConfigurator } from "./ProductSaleConfigurator";
import { formatPriceLabel, getRemainingStockLabel } from "./saleUtils";
import { ToastContainer } from "./Toast";

interface ProductSalePageProps {
  productId: number;
}

export function ProductSalePage({ productId }: ProductSalePageProps) {
  const product = useLiveQuery(() => db.products.get(productId), [productId]);

  const previewObjectUrl = useMemo(
    () => (product?.imageBlob ? URL.createObjectURL(product.imageBlob) : null),
    [product],
  );
  const previewUrl = previewObjectUrl || product?.imageUrl;

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  if (!Number.isFinite(productId)) {
    return <div className="p-10 text-center text-red-500">Producto invalido.</div>;
  }

  if (product === undefined) {
    return <div className="p-10 text-center text-gray-500">Cargando producto...</div>;
  }

  if (!product) {
    return <div className="p-10 text-center text-gray-500">No se encontro el producto.</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-10">
      <ToastContainer />
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
                {previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-semibold text-gray-900">{product.category}</p>
                <p className="mt-1">{formatPriceLabel(product)}</p>
                <p className="mt-1">Stock disponible: {getRemainingStockLabel(product)}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">
                  Venta directa
                </p>
                <h1 className="mt-2 text-3xl font-black text-gray-900">{product.name}</h1>
                {product.description && (
                  <p className="mt-3 text-sm text-gray-500">{product.description}</p>
                )}
              </div>

              <ProductSaleConfigurator product={product} onCancel={() => window.close()} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
