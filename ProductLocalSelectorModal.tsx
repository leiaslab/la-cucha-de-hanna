"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

interface ProductLocalSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (localId: number) => void;
  onCreateLocal: () => void;
}

export function ProductLocalSelectorModal({
  isOpen,
  onClose,
  onContinue,
  onCreateLocal,
}: ProductLocalSelectorModalProps) {
  const availableLocales = useLiveQuery(() => db.locals.orderBy("name").toArray(), []);
  const [selectedLocalId, setSelectedLocalId] = useState<number | null>(null);

  const resolvedSelectedLocalId = useMemo(() => {
    if ((availableLocales?.length ?? 0) === 0) {
      return null;
    }

    if (selectedLocalId && availableLocales?.some((locale) => locale.id === selectedLocalId)) {
      return selectedLocalId;
    }

    return availableLocales?.[0]?.id ?? null;
  }, [availableLocales, selectedLocalId]);

  if (!isOpen) {
    return null;
  }

  const hasLocales = (availableLocales?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-3 py-4 sm:px-6 sm:py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">Nuevo producto</h2>
          <p className="mt-1 text-sm text-slate-500">
            Antes de cargarlo, elige a que local lo quieres vincular primero.
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {hasLocales ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Local
                <select
                  value={resolvedSelectedLocalId ?? ""}
                  onChange={(event) => setSelectedLocalId(Number(event.target.value))}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {(availableLocales ?? []).map((locale) => (
                    <option key={locale.id} value={locale.id}>
                      {locale.name}
                    </option>
                  ))}
                </select>
              </label>

              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                El producto se va a crear arrancando con el stock de ese local. Luego, si quieres, puedes cargar otros locales al editarlo.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Todavia no hay locales creados. Primero crea un local para poder cargar productos.
              </p>
              <button
                type="button"
                onClick={onCreateLocal}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Crear primer local
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          {hasLocales && (
            <button
              type="button"
              onClick={() => {
                if (resolvedSelectedLocalId) {
                  onContinue(resolvedSelectedLocalId);
                }
              }}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
