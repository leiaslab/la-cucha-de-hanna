"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product, type StockUnit } from "./db";
import { saveProductRemote } from "./src/lib/api-client";

type SaleMode = "unit" | "kg" | "liter";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  productToEdit,
}: ProductFormModalProps) {
  const [name, setName] = useState(productToEdit?.name ?? "");
  const [price, setPrice] = useState(productToEdit ? String(productToEdit.price) : "");
  const [cost, setCost] = useState(
    productToEdit ? String(productToEdit.cost ?? productToEdit.price ?? 0) : "",
  );
  const [stock, setStock] = useState(productToEdit ? String(productToEdit.stock) : "");
  const [lowStockAlertThreshold, setLowStockAlertThreshold] = useState(
    productToEdit ? String(productToEdit.lowStockAlertThreshold ?? 5) : "5",
  );
  const [saleType, setSaleType] = useState(productToEdit?.saleType ?? "fixed");
  const [stockUnit, setStockUnit] = useState<StockUnit>(productToEdit?.stockUnit ?? "unit");
  const [category, setCategory] = useState(productToEdit?.category ?? "");
  const [selectedCategory, setSelectedCategory] = useState(productToEdit?.category ?? "");
  const [imageUrl, setImageUrl] = useState(productToEdit?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState(productToEdit?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const saleMode: SaleMode = saleType === "fixed" ? "unit" : stockUnit === "liter" ? "liter" : "kg";
  const existingCategories = useLiveQuery(async () => {
    const products = await db.products.toArray();
    return Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, []);

  const previewBlob = imageFile ?? (!imageUrl ? productToEdit?.imageBlob ?? null : null);
  const previewObjectUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  const previewUrl = imageUrl || previewObjectUrl;
  const readFileAsDataUrl = async (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  if (!isOpen) {
    return null;
  }

  const generateSlug = (productName: string) => {
    return productName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const trimmedDescription = description.trim();
    const trimmedImageUrl = imageUrl.trim();
    const parsedPrice = Number(price);
    const parsedCost = Number(cost);
    const parsedStock = Number(stock);
    const parsedLowStockAlertThreshold = Number(lowStockAlertThreshold);
    const normalizedStockUnit: StockUnit =
      saleType === "fixed" ? "unit" : stockUnit === "liter" ? "liter" : "kg";

    if (!trimmedName || !trimmedCategory || price === "" || cost === "" || stock === "" || lowStockAlertThreshold === "") {
      setError("Completa nombre, precio, costo, stock, alerta y categoria.");
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("El precio debe ser un numero valido.");
      return;
    }

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setError("El costo debe ser un numero valido.");
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError("El stock debe ser un numero valido.");
      return;
    }

    if (!Number.isFinite(parsedLowStockAlertThreshold) || parsedLowStockAlertThreshold < 0) {
      setError("La alerta de stock debe ser un numero valido.");
      return;
    }

    let nextImageUrl = trimmedImageUrl || productToEdit?.imageUrl || undefined;
    if (imageFile) {
      nextImageUrl = await readFileAsDataUrl(imageFile);
    }

    const productData = {
      name: trimmedName,
      slug: generateSlug(trimmedName),
      price: parsedPrice,
      cost: parsedCost,
      stock: parsedStock,
      lowStockAlertThreshold: parsedLowStockAlertThreshold,
      category: trimmedCategory,
      saleType,
      stockUnit: normalizedStockUnit,
      imageUrl: nextImageUrl,
      description: trimmedDescription || undefined,
      lastUpdated: Date.now(),
    };

    try {
      await saveProductRemote(productData, productToEdit?.id);
      onClose();
    } catch (err) {
      setError("Error al guardar el producto: " + (err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-3 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">
            {productToEdit ? "Editar" : "Agregar Nuevo"} Producto
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Carga los datos del producto y reutiliza una categoria existente si ya la tenes creada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(100vh-7rem)] overflow-y-auto px-5 py-4 sm:px-6">
          <div className="space-y-4">
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

            {previewUrl && (
              <div>
                <span className="mb-2 block text-sm font-medium text-slate-700">Vista previa</span>
                <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 sm:h-44">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label htmlFor="price" className="block text-sm font-medium text-slate-700">
                  {saleType === "weight"
                    ? `Precio por ${stockUnit === "liter" ? "litro" : "kilo"}`
                    : "Precio fijo"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label htmlFor="cost" className="block text-sm font-medium text-slate-700">
                  {saleType === "weight"
                    ? `Costo por ${stockUnit === "liter" ? "litro" : "kilo"}`
                    : "Costo por unidad"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="cost"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                  step="0.01"
                  min="0"
                />
              </div>

              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-slate-700">
                  Stock ({stockUnit === "kg" ? "kg" : stockUnit === "liter" ? "litros" : "unidades"}){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="stock"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                  min="0"
                  step={stockUnit === "unit" ? "1" : "0.25"}
                />
              </div>

              <div>
                <label htmlFor="lowStockAlertThreshold" className="block text-sm font-medium text-slate-700">
                  Alerta de stock bajo <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="lowStockAlertThreshold"
                  value={lowStockAlertThreshold}
                  onChange={(e) => setLowStockAlertThreshold(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                  min="0"
                  step={stockUnit === "unit" ? "1" : "0.25"}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Cuando llegue a este numero o menos, se marcara en rojo y tirara alerta.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="saleType" className="block text-sm font-medium text-slate-700">
                  Tipo de venta <span className="text-red-500">*</span>
                </label>
                <select
                  id="saleType"
                  value={saleMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as SaleMode;
                    if (nextMode === "unit") {
                      setSaleType("fixed");
                      setStockUnit("unit");
                      return;
                    }

                    setSaleType("weight");
                    setStockUnit(nextMode as StockUnit);
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="unit">Por unidad</option>
                  <option value="kg">Por kilo</option>
                  <option value="liter">Por litro</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {saleMode === "unit"
                    ? "Ideal para accesorios o productos con precio fijo por unidad."
                    : `El producto se vende por ${saleMode === "liter" ? "litro" : "kilo"} y el stock tambien se descuenta en esa unidad.`}
                </p>
              </div>

              <div>
                <label htmlFor="existingCategory" className="block text-sm font-medium text-slate-700">
                  Categoria existente
                </label>
                <select
                  id="existingCategory"
                  value={selectedCategory}
                  onChange={(e) => {
                    const nextCategory = e.target.value;
                    setSelectedCategory(nextCategory);
                    if (nextCategory) {
                      setCategory(nextCategory);
                    }
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Elegir categoria...</option>
                  {(existingCategories ?? []).map((existingCategory) => (
                    <option key={existingCategory} value={existingCategory}>
                      {existingCategory}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-700">
                  Categoria <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="category"
                  list="product-categories"
                  value={category}
                  onChange={(e) => {
                    const nextCategory = e.target.value;
                    setCategory(nextCategory);
                    setSelectedCategory((existingCategories ?? []).includes(nextCategory) ? nextCategory : "");
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Escribe una nueva o usa una existente"
                  required
                />
                <datalist id="product-categories">
                  {(existingCategories ?? []).map((existingCategory) => (
                    <option key={existingCategory} value={existingCategory} />
                  ))}
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="imageFile" className="block text-sm font-medium text-slate-700">
                  Imagen Local (opcional)
                </label>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-500 shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="imageUrl" className="block text-sm font-medium text-slate-700">
                  URL de la Imagen (opcional)
                </label>
                <input
                  type="url"
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                  Descripcion (opcional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 mt-6 flex justify-end gap-3 border-t border-slate-100 bg-white pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {productToEdit ? "Actualizar" : "Agregar"} Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
