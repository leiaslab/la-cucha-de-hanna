"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalRecord, type Product, type SessionUser, type StockUnit } from "./db";
import {
  deleteProductCategoryRemote,
  moveProductCategoryRemote,
  saveProductRemote,
} from "./src/lib/api-client";

type SaleMode = "unit" | "kg" | "liter";

type LocalStockFormState = {
  localId: number;
  localName: string;
  stock: string;
  lowStockAlertThreshold: string;
};

function parseDecimalInput(value: string) {
  return Number(value.replace(",", ".").trim());
}

function buildLocalStockFields(
  productToEdit: Product | null | undefined,
  availableLocales: LocalRecord[] | undefined,
  currentUser: SessionUser | null | undefined,
  preferredLocalId?: number | null,
): LocalStockFormState[] {
  const rows = new Map<number, LocalStockFormState>();

  if (!productToEdit && preferredLocalId) {
    const preferredLocal = (availableLocales ?? []).find((locale) => locale.id === preferredLocalId);
    rows.set(preferredLocalId, {
      localId: preferredLocalId,
      localName: preferredLocal?.name ?? currentUser?.localName ?? "Local seleccionado",
      stock: "0",
      lowStockAlertThreshold: "5",
    });
  } else {
    (availableLocales ?? []).forEach((locale) => {
      rows.set(locale.id, {
        localId: locale.id,
        localName: locale.name,
        stock: "0",
        lowStockAlertThreshold: "5",
      });
    });
  }

  if ((productToEdit || !preferredLocalId) && currentUser?.localId && !rows.has(currentUser.localId)) {
    rows.set(currentUser.localId, {
      localId: currentUser.localId,
      localName: currentUser.localName ?? "Local actual",
      stock: "0",
      lowStockAlertThreshold: "5",
    });
  }

  (productToEdit?.localStocks ?? []).forEach((localStock) => {
    rows.set(localStock.localId, {
      localId: localStock.localId,
      localName: localStock.localName ?? rows.get(localStock.localId)?.localName ?? `Local ${localStock.localId}`,
      stock: String(localStock.stock),
      lowStockAlertThreshold: String(localStock.lowStockAlertThreshold ?? 5),
    });
  });

  if (productToEdit && rows.size === 0) {
    const fallbackLocalId = currentUser?.localId ?? 1;
    rows.set(fallbackLocalId, {
      localId: fallbackLocalId,
      localName: currentUser?.localName ?? "Local principal",
      stock: String(productToEdit.stock),
      lowStockAlertThreshold: String(productToEdit.lowStockAlertThreshold ?? 5),
    });
  }

  return Array.from(rows.values()).sort((a, b) => {
    if (preferredLocalId) {
      if (a.localId === preferredLocalId) {
        return -1;
      }

      if (b.localId === preferredLocalId) {
        return 1;
      }
    }

    return a.localName.localeCompare(b.localName);
  });
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  currentUser?: SessionUser | null;
  preferredLocalId?: number | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  productToEdit,
  currentUser,
  preferredLocalId,
}: ProductFormModalProps) {
  const [code, setCode] = useState(productToEdit?.code ?? "");
  const [name, setName] = useState(productToEdit?.name ?? "");
  const [price, setPrice] = useState(productToEdit ? String(productToEdit.price) : "");
  const [cost, setCost] = useState(
    productToEdit ? String(productToEdit.cost ?? productToEdit.price ?? 0) : "",
  );
  const [saleType, setSaleType] = useState(productToEdit?.saleType ?? "fixed");
  const [stockUnit, setStockUnit] = useState<StockUnit>(productToEdit?.stockUnit ?? "unit");
  const [category, setCategory] = useState(productToEdit?.category ?? "");
  const [selectedCategory, setSelectedCategory] = useState(productToEdit?.category ?? "");
  const [subcategory, setSubcategory] = useState(productToEdit?.subcategory ?? "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    productToEdit?.subcategory ?? "",
  );
  const [targetCategory, setTargetCategory] = useState("");
  const [isManagingCategory, setIsManagingCategory] = useState(false);
  const [isCategoryActionPending, setIsCategoryActionPending] = useState(false);
  const [imageUrl] = useState(productToEdit?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [description, setDescription] = useState(productToEdit?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const availableLocales = useLiveQuery(() => db.locals.toArray());
  const [localStocks, setLocalStocks] = useState<LocalStockFormState[]>(() =>
    buildLocalStockFields(productToEdit, availableLocales, currentUser, preferredLocalId),
  );
  const saleMode: SaleMode = saleType === "fixed" ? "unit" : stockUnit === "liter" ? "liter" : "kg";
  const existingCategories = useLiveQuery(async () => {
    const products = await db.products.toArray();
    return Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, []);
  const existingSubcategories = useLiveQuery(async () => {
    const normalizedCategory = category.trim().toLocaleLowerCase("es");
    if (!normalizedCategory) {
      return [];
    }

    const products = await db.products.toArray();
    return Array.from(
      new Set(
        products
          .filter((product) => product.category.trim().toLocaleLowerCase("es") === normalizedCategory)
          .map((product) => product.subcategory?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [category]);
  const selectedCategoryProductCount = useLiveQuery(
    () =>
      selectedCategory
        ? db.products.where("category").equals(selectedCategory).count()
        : Promise.resolve(0),
    [selectedCategory],
  );

  const previewBlob = imageFile ?? (!imageUrl ? productToEdit?.imageBlob ?? null : null);
  const previewObjectUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
  );
  const previewUrl = previewObjectUrl || imageUrl;
  const preventWheelChange = (event: React.WheelEvent<HTMLInputElement>) => {
    event.currentTarget.blur();
  };
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

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const trimmedSubcategory = subcategory.trim();
    const trimmedDescription = description.trim();
    const trimmedImageUrl = imageUrl.trim();
    const parsedPrice = Number(price);
    const parsedCost = Number(cost);
    const normalizedStockUnit: StockUnit =
      saleType === "fixed" ? "unit" : stockUnit === "liter" ? "liter" : "kg";

    if (!trimmedName || !trimmedCategory || price === "" || cost === "") {
      setError("Completa nombre, precio, costo y categoria.");
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

    if (localStocks.length === 0) {
      setError("Primero crea al menos un local para poder cargar stock.");
      return;
    }

    const normalizedLocalStocks = localStocks.map((localStock) => ({
      localId: localStock.localId,
      localName: localStock.localName,
      stock: localStock.stock.trim() === "" ? 0 : parseDecimalInput(localStock.stock),
      lowStockAlertThreshold: parseDecimalInput(localStock.lowStockAlertThreshold),
    }));

    const invalidLocalStock = normalizedLocalStocks.find(
      (localStock) =>
        !Number.isFinite(localStock.stock) ||
        localStock.stock < 0 ||
        !Number.isFinite(localStock.lowStockAlertThreshold) ||
        localStock.lowStockAlertThreshold < 0,
    );

    if (invalidLocalStock) {
      setError(`Revisa el stock o la alerta del local "${invalidLocalStock.localName}".`);
      return;
    }

    let nextImageUrl = trimmedImageUrl || productToEdit?.imageUrl || undefined;
    if (imageFile) {
      nextImageUrl = await readFileAsDataUrl(imageFile);
    }

    const preferredLocalStock =
      normalizedLocalStocks.find((localStock) => localStock.localId === preferredLocalId) ??
      normalizedLocalStocks.find((localStock) => localStock.localId === currentUser?.localId) ??
      normalizedLocalStocks[0];

    const productData = {
      code: trimmedCode || undefined,
      name: trimmedName,
      slug: generateSlug(trimmedName),
      price: parsedPrice,
      cost: parsedCost,
      stock: preferredLocalStock?.stock ?? 0,
      preferredLocalId: preferredLocalStock?.localId ?? preferredLocalId ?? undefined,
      lowStockAlertThreshold: preferredLocalStock?.lowStockAlertThreshold ?? 5,
      category: trimmedCategory,
      subcategory: trimmedSubcategory || undefined,
      saleType,
      stockUnit: normalizedStockUnit,
      imageUrl: nextImageUrl,
      description: trimmedDescription || undefined,
      localStocks: normalizedLocalStocks,
      lastUpdated: Date.now(),
    };

    try {
      await saveProductRemote(productData, productToEdit?.id);
      onClose();
    } catch (err) {
      setError("Error al guardar el producto: " + (err as Error).message);
    }
  };

  const handleMoveCategory = async () => {
    const source = selectedCategory.trim();
    const target = targetCategory.trim();
    if (!source || !target) {
      setError("Elegi la categoria de origen y escribi una categoria de destino.");
      return;
    }

    if (
      !window.confirm(
        `Se moveran ${selectedCategoryProductCount ?? 0} producto(s) de "${source}" a "${target}". ¿Continuar?`,
      )
    ) {
      return;
    }

    try {
      setError(null);
      setIsCategoryActionPending(true);
      await moveProductCategoryRemote(source, target);
      onClose();
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setIsCategoryActionPending(false);
    }
  };

  const handleDeleteCategory = async () => {
    const source = selectedCategory.trim();
    if (!source) {
      return;
    }

    const productCount = selectedCategoryProductCount ?? 0;
    if (
      !window.confirm(
        `ATENCION: se eliminara la categoria "${source}" y sus ${productCount} producto(s). Esta accion no se puede deshacer. ¿Eliminar?`,
      )
    ) {
      return;
    }

    try {
      setError(null);
      setIsCategoryActionPending(true);
      await deleteProductCategoryRemote(source);
      onClose();
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setIsCategoryActionPending(false);
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
            {productToEdit
              ? "Actualiza los datos del producto y ajusta su stock por local."
              : "Carga los datos del producto y arrancalo en el local que elegiste."}
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
                <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                  Codigo del producto <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: 7791234567890 o ALIM-PERRO-01"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Debe ser unico. Luego podes escribirlo en Buscar y presionar Enter para vender.
                </p>
              </div>

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
                  onWheel={preventWheelChange}
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
                  onWheel={preventWheelChange}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  required
                  step="0.01"
                  min="0"
                />
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

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        Stock por local
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {productToEdit
                          ? "Cada local maneja su propio stock y su propia alerta."
                          : "El stock es opcional. Si lo dejas vacio, el producto comienza en cero."}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                      {stockUnit === "kg" ? "kg" : stockUnit === "liter" ? "litros" : "unidades"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {localStocks.length === 0 ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        Primero crea al menos un local desde Locales para poder cargar stock.
                      </p>
                    ) : (
                      localStocks.map((localStock) => (
                        <div
                          key={localStock.localId}
                          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_150px_170px]"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{localStock.localName}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Puedes dejar el stock vacio para guardarlo en cero.
                            </p>
                          </div>

                          <div>
                            <label
                              htmlFor={`stock-${localStock.localId}`}
                              className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                            >
                              Stock
                            </label>
                            <input
                              type="text"
                              id={`stock-${localStock.localId}`}
                              value={localStock.stock}
                              onChange={(event) =>
                                setLocalStocks((current) =>
                                  current.map((candidate) =>
                                    candidate.localId === localStock.localId
                                      ? {
                                          ...candidate,
                                          stock: event.target.value.replace(",", "."),
                                        }
                                      : candidate,
                                  ),
                                )
                              }
                              className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              inputMode={stockUnit === "unit" ? "numeric" : "decimal"}
                              autoComplete="off"
                              placeholder={stockUnit === "unit" ? "0" : "0.00"}
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`alert-${localStock.localId}`}
                              className="block text-xs font-medium uppercase tracking-[0.14em] text-slate-500"
                            >
                              Alerta
                            </label>
                            <input
                              type="text"
                              id={`alert-${localStock.localId}`}
                              value={localStock.lowStockAlertThreshold}
                              onChange={(event) =>
                                setLocalStocks((current) =>
                                  current.map((candidate) =>
                                    candidate.localId === localStock.localId
                                      ? {
                                          ...candidate,
                                          lowStockAlertThreshold: event.target.value.replace(",", "."),
                                        }
                                      : candidate,
                                  ),
                                )
                              }
                              className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              inputMode={stockUnit === "unit" ? "numeric" : "decimal"}
                              autoComplete="off"
                              required
                              placeholder={stockUnit === "unit" ? "0" : "0.00"}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                      setSubcategory("");
                      setSelectedSubcategory("");
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
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsManagingCategory((current) => !current);
                      setTargetCategory("");
                    }}
                    className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    {isManagingCategory ? "Ocultar administracion" : "Administrar categoria"}
                  </button>
                )}
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
                    if (nextCategory !== category) {
                      setSubcategory("");
                      setSelectedSubcategory("");
                    }
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

              {selectedCategory && isManagingCategory && (
                <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-sm font-bold text-slate-800">
                    Administrar &quot;{selectedCategory}&quot;
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Esta categoria contiene {selectedCategoryProductCount ?? 0} producto(s).
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <label htmlFor="targetCategory" className="block text-xs font-semibold text-slate-600">
                        Mover todos los productos a
                      </label>
                      <input
                        id="targetCategory"
                        type="text"
                        list="target-product-categories"
                        value={targetCategory}
                        onChange={(event) => setTargetCategory(event.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="Categoria existente o nueva"
                      />
                      <datalist id="target-product-categories">
                        {(existingCategories ?? [])
                          .filter((candidate) => candidate !== selectedCategory)
                          .map((candidate) => (
                            <option key={candidate} value={candidate} />
                          ))}
                      </datalist>
                    </div>
                    <button
                      type="button"
                      onClick={handleMoveCategory}
                      disabled={isCategoryActionPending || !targetCategory.trim()}
                      className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mover productos
                    </button>
                  </div>

                  <div className="mt-4 border-t border-amber-200 pt-4">
                    <button
                      type="button"
                      onClick={handleDeleteCategory}
                      disabled={isCategoryActionPending}
                      className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Eliminar categoria y productos
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="existingSubcategory"
                  className="block text-sm font-medium text-slate-700"
                >
                  Subcategoria existente
                </label>
                <select
                  id="existingSubcategory"
                  value={selectedSubcategory}
                  onChange={(event) => {
                    const nextSubcategory = event.target.value;
                    setSelectedSubcategory(nextSubcategory);
                    setSubcategory(nextSubcategory);
                  }}
                  disabled={!category.trim() || (existingSubcategories ?? []).length === 0}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {(existingSubcategories ?? []).length > 0
                      ? "Elegir subcategoria..."
                      : "No hay subcategorias cargadas"}
                  </option>
                  {(existingSubcategories ?? []).map((existingSubcategory) => (
                    <option key={existingSubcategory} value={existingSubcategory}>
                      {existingSubcategory}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subcategory" className="block text-sm font-medium text-slate-700">
                  Subcategoria nueva <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  id="subcategory"
                  value={subcategory}
                  onChange={(event) => {
                    const nextSubcategory = event.target.value;
                    setSubcategory(nextSubcategory);
                    setSelectedSubcategory(
                      (existingSubcategories ?? []).includes(nextSubcategory)
                        ? nextSubcategory
                        : "",
                    );
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder={category.trim() ? "Escribe una nueva" : "Primero elige una categoria"}
                  disabled={!category.trim()}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="imageFile" className="block text-sm font-medium text-slate-700">
                  Imagen del producto (opcional)
                </label>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-500 shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                {productToEdit?.imageUrl && (
                  <p className="mt-1 text-xs text-slate-500">
                    Si no eliges otra imagen, se conserva la actual.
                  </p>
                )}
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
