"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientRecord } from "./src/lib/pos-types";
import { createClientRemote, listClientsRemote } from "./src/lib/api-client";
import { showToast } from "./Toast";

interface ClientSelectorProps {
  value: number | null;
  onChange: (clientId: number | null) => void;
  compact?: boolean;
}

export function ClientSelector({ value, onChange, compact = false }: ClientSelectorProps) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  useEffect(() => {
    const loadClients = async () => {
      try {
        const nextClients = await listClientsRemote();
        setClients(nextClients);
      } catch (error) {
        console.error("No se pudieron cargar los clientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadClients();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === value) ?? null,
    [clients, value],
  );

  const handleCreateClient = async () => {
    const fullName = newClientName.trim();
    const phone = newClientPhone.trim();

    if (!fullName) {
      showToast("Ingresa al menos el nombre del cliente.", "error");
      return;
    }

    try {
      const created = await createClientRemote({
        fullName,
        phone: phone || undefined,
      });
      setClients((current) =>
        [...current, created].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
      onChange(created.id ?? null);
      setNewClientName("");
      setNewClientPhone("");
      setIsCreating(false);
      showToast("Cliente creado con exito.", "success");
    } catch (error) {
      console.error("No se pudo crear el cliente:", error);
      showToast("No se pudo guardar el cliente.", "error");
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${
        compact ? "px-3 py-3" : "px-4 py-4"
      } dark:border-slate-700 dark:bg-slate-900/50`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Cliente
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {selectedClient ? selectedClient.fullName : "Consumidor final"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating((current) => !current)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {isCreating ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      <div className="mt-3">
        <select
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
          className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          disabled={isLoading}
        >
          <option value="">Consumidor final</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.fullName}
              {client.phone ? ` - ${client.phone}` : ""}
            </option>
          ))}
        </select>
      </div>

      {isCreating && (
        <div className="mt-3 grid gap-3">
          <input
            type="text"
            value={newClientName}
            onChange={(event) => setNewClientName(event.target.value)}
            className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Nombre del cliente"
          />
          <input
            type="text"
            value={newClientPhone}
            onChange={(event) => setNewClientPhone(event.target.value)}
            className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Telefono (opcional)"
          />
          <button
            type="button"
            onClick={() => void handleCreateClient()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Guardar cliente
          </button>
        </div>
      )}
    </div>
  );
}
