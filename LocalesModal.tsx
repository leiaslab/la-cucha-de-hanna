"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Product } from "./db";
import { optimizeLocalLogo } from "./imageUtils";
import { createLocalRemote, deleteLocalRemote, updateLocalRemote } from "./src/lib/api-client";
import { showToast } from "./Toast";

interface ProductAssignmentPickerProps {
  products: Product[];
  selectedProductIds: Set<number>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectionChange: (productIds: Set<number>) => void;
}

function ProductAssignmentPicker({
  products,
  selectedProductIds,
  searchTerm,
  onSearchTermChange,
  onSelectionChange,
}: ProductAssignmentPickerProps) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("es");
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          !normalizedSearch ||
          product.name.toLocaleLowerCase("es").includes(normalizedSearch) ||
          product.code?.toLocaleLowerCase("es").includes(normalizedSearch) ||
          product.category.toLocaleLowerCase("es").includes(normalizedSearch),
      ),
    [normalizedSearch, products],
  );
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, Product[]>();

    visibleProducts.forEach((product) => {
      if (!product.id) {
        return;
      }

      const category = product.category.trim() || "Sin categoría";
      groups.set(category, [...(groups.get(category) ?? []), product]);
    });

    return Array.from(groups.entries())
      .map(([category, categoryProducts]) => ({ category, categoryProducts }))
      .sort((a, b) => a.category.localeCompare(b.category, "es", { sensitivity: "base" }));
  }, [visibleProducts]);

  const toggleProduct = (productId: number) => {
    const nextSelection = new Set(selectedProductIds);
    if (nextSelection.has(productId)) {
      nextSelection.delete(productId);
    } else {
      nextSelection.add(productId);
    }
    onSelectionChange(nextSelection);
  };

  const toggleCategory = (categoryProductIds: number[]) => {
    const nextSelection = new Set(selectedProductIds);
    const isCompleteCategorySelected = categoryProductIds.every((productId) =>
      nextSelection.has(productId),
    );

    categoryProductIds.forEach((productId) => {
      if (isCompleteCategorySelected) {
        nextSelection.delete(productId);
      } else {
        nextSelection.add(productId);
      }
    });

    onSelectionChange(nextSelection);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className="block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Buscar producto, codigo o categoria"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() =>
              onSelectionChange(
                new Set([
                  ...selectedProductIds,
                  ...visibleProducts.flatMap((product) => (product.id ? [product.id] : [])),
                ]),
              )
            }
            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
          >
            Marcar visibles
          </button>
          <button
            type="button"
            onClick={() => {
              const visibleIds = new Set(visibleProducts.flatMap((product) => (product.id ? [product.id] : [])));
              onSelectionChange(
                new Set(Array.from(selectedProductIds).filter((productId) => !visibleIds.has(productId))),
              );
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Desmarcar visibles
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{selectedProductIds.size} productos seleccionados</span>
        <span>{visibleProducts.length} visibles</span>
      </div>

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {categoryGroups.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            No se encontraron productos.
          </p>
        ) : (
          categoryGroups.map(({ category, categoryProducts }) => {
            const categoryProductIds = categoryProducts.flatMap((product) =>
              product.id ? [product.id] : [],
            );
            const selectedCount = categoryProductIds.filter((productId) =>
              selectedProductIds.has(productId),
            ).length;
            const isFullySelected = selectedCount === categoryProductIds.length;

            return (
              <details
                key={category}
                open={normalizedSearch ? true : undefined}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-3 py-3 marker:content-none dark:bg-slate-800/70">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      {category}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {selectedCount}/{categoryProductIds.length} productos seleccionados
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    ▼
                  </span>
                </summary>

                <div className="border-t border-slate-200 p-3 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryProductIds)}
                    className={`mb-3 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      isFullySelected
                        ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                        : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                    }`}
                  >
                    {isFullySelected ? "Desmarcar toda la categoría" : "Marcar toda la categoría"}
                  </button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {categoryProducts.map((product) => {
                      if (!product.id) {
                        return null;
                      }

                      return (
                        <label
                          key={product.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                            selectedProductIds.has(product.id)
                              ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(product.id)}
                            onChange={() => toggleProduct(product.id!)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">
                              {product.name}
                            </span>
                            {product.code && (
                              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                Cod. {product.code}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}

interface LocalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocalCreated?: (localId: number) => void;
}

export function LocalesModal({ isOpen, onClose, onLocalCreated }: LocalesModalProps) {
  const [newLocalName, setNewLocalName] = useState("");
  const [newLocalPrinterEnabled, setNewLocalPrinterEnabled] = useState(true);
  const [newLocalStockControlEnabled, setNewLocalStockControlEnabled] = useState(true);
  const [newLocalProductIds, setNewLocalProductIds] = useState<Set<number>>(() => new Set());
  const [newLocalProductSearch, setNewLocalProductSearch] = useState("");
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);
  const [editingLocalId, setEditingLocalId] = useState<number | null>(null);
  const [editingLocalName, setEditingLocalName] = useState("");
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isUpdatingLogoLocalId, setIsUpdatingLogoLocalId] = useState<number | null>(null);
  const [isUpdatingPrinterLocalId, setIsUpdatingPrinterLocalId] = useState<number | null>(null);
  const [isUpdatingStockControlLocalId, setIsUpdatingStockControlLocalId] = useState<number | null>(null);
  const [isDeletingLocalId, setIsDeletingLocalId] = useState<number | null>(null);
  const [managingProductsLocalId, setManagingProductsLocalId] = useState<number | null>(null);
  const [managedProductIds, setManagedProductIds] = useState<Set<number>>(() => new Set());
  const [managedProductSearch, setManagedProductSearch] = useState("");
  const [isSavingProductsLocalId, setIsSavingProductsLocalId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availableLocales = useLiveQuery(() => db.locals.orderBy("name").toArray(), []);
  const availableProducts = useLiveQuery(() => db.products.orderBy("name").toArray(), []);

  if (!isOpen) {
    return null;
  }

  const handleCreateLocal = async () => {
    const trimmedName = newLocalName.trim();

    if (!trimmedName) {
      showToast("Escribe un nombre para el local.", "error");
      return;
    }

    setIsCreatingLocal(true);
    setError(null);

    try {
      const createdLocal = await createLocalRemote({
        name: trimmedName,
        thermalPrinterEnabled: newLocalPrinterEnabled,
        stockControlEnabled: newLocalStockControlEnabled,
        productIds: Array.from(newLocalProductIds),
      });
      setNewLocalName("");
      setNewLocalPrinterEnabled(true);
      setNewLocalStockControlEnabled(true);
      setNewLocalProductIds(new Set());
      setNewLocalProductSearch("");
      onLocalCreated?.(createdLocal.id);
      showToast(`Local "${createdLocal.name}" creado con exito.`, "success");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el local.");
    } finally {
      setIsCreatingLocal(false);
    }
  };

  const handleStartEditLocal = (localId: number, localName: string) => {
    setEditingLocalId(localId);
    setEditingLocalName(localName);
    setError(null);
  };

  const handleCancelEditLocal = () => {
    setEditingLocalId(null);
    setEditingLocalName("");
  };

  const handleSaveLocal = async (localId: number) => {
    const trimmedName = editingLocalName.trim();

    if (!trimmedName) {
      showToast("Escribe un nombre valido para el local.", "error");
      return;
    }

    setIsSavingLocal(true);
    setError(null);

    try {
      await updateLocalRemote(localId, { name: trimmedName });
      handleCancelEditLocal();
      showToast("Local actualizado con exito.", "success");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el local.");
    } finally {
      setIsSavingLocal(false);
    }
  };

  const handleToggleLocalPrinter = async (localId: number, enabled: boolean) => {
    setError(null);
    setIsUpdatingPrinterLocalId(localId);

    try {
      await updateLocalRemote(localId, { thermalPrinterEnabled: enabled });
      showToast(
        enabled
          ? "Impresora habilitada para este local."
          : "Impresora desactivada para este local.",
        "success",
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar la impresora del local.",
      );
    } finally {
      setIsUpdatingPrinterLocalId(null);
    }
  };

  const handleToggleLocalStockControl = async (localId: number, enabled: boolean) => {
    setError(null);
    setIsUpdatingStockControlLocalId(localId);

    try {
      await updateLocalRemote(localId, { stockControlEnabled: enabled });
      showToast(
        enabled
          ? "Control de stock activado para este local."
          : "Control de stock desactivado para este local.",
        "success",
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el control de stock del local.",
      );
    } finally {
      setIsUpdatingStockControlLocalId(null);
    }
  };

  const handleStartManageProducts = (localId: number) => {
    setManagingProductsLocalId(localId);
    setManagedProductIds(
      new Set(
        (availableProducts ?? []).flatMap((product) =>
          product.id && product.localStocks?.some((localStock) => localStock.localId === localId)
            ? [product.id]
            : [],
        ),
      ),
    );
    setManagedProductSearch("");
    setError(null);
  };

  const handleCancelManageProducts = () => {
    setManagingProductsLocalId(null);
    setManagedProductIds(new Set());
    setManagedProductSearch("");
  };

  const handleSaveLocalProducts = async (localId: number) => {
    setIsSavingProductsLocalId(localId);
    setError(null);

    try {
      await updateLocalRemote(localId, { productIds: Array.from(managedProductIds) });
      handleCancelManageProducts();
      showToast("Productos del local actualizados.", "success");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron actualizar los productos del local.",
      );
    } finally {
      setIsSavingProductsLocalId(null);
    }
  };

  const handleLocalLogoChange = async (
    localId: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setIsUpdatingLogoLocalId(localId);

    try {
      const logoUrl = await optimizeLocalLogo(file);
      await updateLocalRemote(localId, { logoUrl });
      showToast("Logo del local actualizado.", "success");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el logo del local.",
      );
    } finally {
      input.value = "";
      setIsUpdatingLogoLocalId(null);
    }
  };

  const handleRemoveLocalLogo = async (localId: number) => {
    setError(null);
    setIsUpdatingLogoLocalId(localId);

    try {
      await updateLocalRemote(localId, { logoUrl: null });
      showToast("Logo del local quitado.", "success");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo quitar el logo del local.",
      );
    } finally {
      setIsUpdatingLogoLocalId(null);
    }
  };

  const handleDeleteLocal = async (localId: number, localName: string) => {
    if (
      !confirm(
        `Se borrara el local "${localName}". Los usuarios deben estar desasignados antes. El stock de ese local se eliminara y las ventas o turnos viejos quedaran como "Sin local". Esta accion no se puede deshacer.`,
      )
    ) {
      return;
    }

    setError(null);
    setIsDeletingLocalId(localId);

    try {
      await deleteLocalRemote(localId);
      if (editingLocalId === localId) {
        handleCancelEditLocal();
      }
      showToast("Local borrado con exito.", "success");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo borrar el local.");
    } finally {
      setIsDeletingLocalId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-900/55 p-4 backdrop-blur-sm sm:py-6">
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Locales
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Los locales se administran por separado. Despues puedes asignar usuarios o productos al local que quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-6 py-5 [scrollbar-gutter:stable]">
          <div className="order-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nuevo local</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Elige solamente los productos que realmente existen en este local. Si no marcas ninguno, empieza vacio.
          </p>

          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newLocalName}
                onChange={(event) => setNewLocalName(event.target.value)}
                className="block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="Ej: Local Centro"
              />
              <button
                type="button"
                onClick={() => void handleCreateLocal()}
                disabled={isCreatingLocal}
                className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
              >
                {isCreatingLocal ? "Creando..." : "Crear local"}
              </button>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
              <input
                type="checkbox"
                checked={newLocalPrinterEnabled}
                onChange={(event) => setNewLocalPrinterEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Impresora habilitada para este local
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Si la desactivas, ese local no imprimira tickets aunque la PC tenga impresora configurada.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
              <input
                type="checkbox"
                checked={newLocalStockControlEnabled}
                onChange={(event) => setNewLocalStockControlEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Controlar stock en este local
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Si lo desactivas, el stock se oculta y las ventas no descuentan existencias.
                </p>
              </div>
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Productos de este local
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Solo los seleccionados apareceran en su pantalla de ventas.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                  {newLocalProductIds.size} elegidos
                </span>
              </div>
              <ProductAssignmentPicker
                products={availableProducts ?? []}
                selectedProductIds={newLocalProductIds}
                searchTerm={newLocalProductSearch}
                onSearchTermChange={setNewLocalProductSearch}
                onSelectionChange={setNewLocalProductIds}
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

          <div className="order-1 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                Locales existentes
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Edita el nombre, los productos y la configuracion de cada local.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              {(availableLocales ?? []).length} locales
            </span>
          </div>
          {(availableLocales ?? []).length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              Todavia no hay locales cargados.
            </p>
          ) : (
            <div className="space-y-3">
              {(availableLocales ?? []).map((locale) => {
                const isEditingLocal = editingLocalId === locale.id;
                const isManagingProducts = managingProductsLocalId === locale.id;
                const assignedProductCount = (availableProducts ?? []).filter((product) =>
                  product.localStocks?.some((localStock) => localStock.localId === locale.id),
                ).length;

                return (
                  <div
                    key={locale.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        {isEditingLocal ? (
                          <input
                            type="text"
                            value={editingLocalName}
                            onChange={(event) => setEditingLocalName(event.target.value)}
                            className="block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        ) : (
                          <div className="space-y-3">
                            <p className="truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                              {locale.name}
                            </p>
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                              <input
                                type="checkbox"
                                checked={locale.thermalPrinterEnabled ?? true}
                                disabled={isUpdatingPrinterLocalId === locale.id}
                                onChange={(event) =>
                                  void handleToggleLocalPrinter(locale.id!, event.target.checked)
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  Impresora habilitada
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {isUpdatingPrinterLocalId === locale.id
                                    ? "Guardando configuracion..."
                                    : "Controla si este local puede imprimir tickets."}
                                </p>
                              </div>
                            </label>
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                              <input
                                type="checkbox"
                                checked={locale.stockControlEnabled ?? true}
                                disabled={isUpdatingStockControlLocalId === locale.id}
                                onChange={(event) =>
                                  void handleToggleLocalStockControl(locale.id, event.target.checked)
                                }
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  Controlar stock
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {isUpdatingStockControlLocalId === locale.id
                                    ? "Guardando configuracion..."
                                    : (locale.stockControlEnabled ?? true)
                                      ? "Muestra y descuenta stock al vender."
                                      : "Stock oculto y sin descuento para todo el local."}
                                </p>
                              </div>
                            </label>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                  {locale.logoUrl ? (
                                    <Image
                                      src={locale.logoUrl}
                                      alt={`Logo de ${locale.name}`}
                                      width={64}
                                      height={64}
                                      unoptimized
                                      className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm dark:bg-slate-900"
                                    />
                                  ) : (
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-[10px] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-900">
                                      Sin logo
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                                      Logo del local
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      Aparece junto al nombre del usuario en la pantalla de venta.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <label
                                    className={`cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50 ${
                                      isUpdatingLogoLocalId === locale.id
                                        ? "pointer-events-none opacity-60"
                                        : ""
                                    }`}
                                  >
                                    {isUpdatingLogoLocalId === locale.id
                                      ? "Guardando..."
                                      : locale.logoUrl
                                        ? "Cambiar logo"
                                        : "Agregar logo"}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      disabled={isUpdatingLogoLocalId === locale.id}
                                      onChange={(event) =>
                                        void handleLocalLogoChange(locale.id, event)
                                      }
                                      className="sr-only"
                                    />
                                  </label>
                                  {locale.logoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRemoveLocalLogo(locale.id)}
                                      disabled={isUpdatingLogoLocalId === locale.id}
                                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                      Quitar logo
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isEditingLocal ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleSaveLocal(locale.id)}
                              disabled={isSavingLocal}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                            >
                              {isSavingLocal ? "Guardando..." : "Guardar"}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditLocal}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                isManagingProducts
                                  ? handleCancelManageProducts()
                                  : handleStartManageProducts(locale.id)
                              }
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                            >
                              {isManagingProducts
                                ? "Cerrar productos"
                                : `Productos (${assignedProductCount})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditLocal(locale.id, locale.name)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Renombrar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteLocal(locale.id, locale.name)}
                              disabled={isDeletingLocalId === locale.id}
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                            >
                              {isDeletingLocalId === locale.id ? "Borrando..." : "Borrar local"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isManagingProducts && (
                      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Productos disponibles en {locale.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Los productos desmarcados dejan de aparecer en este local. Para quitar uno que tiene stock, primero deja su stock en cero.
                          </p>
                        </div>
                        <ProductAssignmentPicker
                          products={availableProducts ?? []}
                          selectedProductIds={managedProductIds}
                          searchTerm={managedProductSearch}
                          onSearchTermChange={setManagedProductSearch}
                          onSelectionChange={setManagedProductIds}
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelManageProducts}
                            disabled={isSavingProductsLocalId === locale.id}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveLocalProducts(locale.id)}
                            disabled={isSavingProductsLocalId === locale.id}
                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSavingProductsLocalId === locale.id
                              ? "Guardando..."
                              : "Guardar productos"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
