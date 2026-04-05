"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { createLocalRemote, deleteLocalRemote, updateLocalRemote } from "./src/lib/api-client";
import { showToast } from "./Toast";

interface LocalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocalCreated?: (localId: number) => void;
}

export function LocalesModal({ isOpen, onClose, onLocalCreated }: LocalesModalProps) {
  const [newLocalName, setNewLocalName] = useState("");
  const [newLocalPrinterEnabled, setNewLocalPrinterEnabled] = useState(true);
  const [isCreatingLocal, setIsCreatingLocal] = useState(false);
  const [editingLocalId, setEditingLocalId] = useState<number | null>(null);
  const [editingLocalName, setEditingLocalName] = useState("");
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isUpdatingPrinterLocalId, setIsUpdatingPrinterLocalId] = useState<number | null>(null);
  const [isDeletingLocalId, setIsDeletingLocalId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availableLocales = useLiveQuery(() => db.locals.orderBy("name").toArray(), []);

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
      });
      setNewLocalName("");
      setNewLocalPrinterEnabled(true);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm sm:py-6">
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
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

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nuevo local</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crea el local primero y despues usalo al cargar productos o usuarios.
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
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          {(availableLocales ?? []).length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              Todavia no hay locales cargados.
            </p>
          ) : (
            <div className="space-y-3">
              {(availableLocales ?? []).map((locale) => {
                const isEditingLocal = editingLocalId === locale.id;

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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
