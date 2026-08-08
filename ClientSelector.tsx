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
  const [isExpanded, setIsExpanded] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientDni, setNewClientDni] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

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
    const firstName = newClientFirstName.trim();
    const lastName = newClientLastName.trim();
    const address = newClientAddress.trim();
    const dni = newClientDni.trim();
    const phone = newClientPhone.trim();
    const email = newClientEmail.trim();

    if (!firstName || !lastName) {
      showToast("Ingresa nombre y apellido del cliente.", "error");
      return;
    }

    try {
      const created = await createClientRemote({
        firstName,
        lastName,
        address: address || undefined,
        dni: dni || undefined,
        phone: phone || undefined,
        email: email || undefined,
      });
      setClients((current) =>
        [...current, created].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
      onChange(created.id ?? null);
      setNewClientFirstName("");
      setNewClientLastName("");
      setNewClientAddress("");
      setNewClientDni("");
      setNewClientPhone("");
      setNewClientEmail("");
      setIsCreating(false);
      setIsExpanded(false);
      showToast("Cliente creado con exito.", "success");
    } catch (error) {
      console.error("No se pudo crear el cliente:", error);
      showToast("No se pudo guardar el cliente.", "error");
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${
        compact ? "px-3 py-2.5" : "px-4 py-4"
      } dark:border-slate-700 dark:bg-slate-900/50`}
    >
      {compact && !isExpanded ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cliente
          </button>
        </div>
      ) : (
        <>
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
          onClick={() => {
            if (compact) {
              setIsExpanded(false);
              setIsCreating(false);
              return;
            }

            setIsCreating((current) => !current);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {compact ? "Cerrar" : isCreating ? "Cancelar" : "Nuevo cliente"}
        </button>
      </div>

      <div className="mt-3">
        <select
          value={value ?? ""}
          onChange={(event) => {
            onChange(event.target.value ? Number(event.target.value) : null);
            if (compact) {
              setIsExpanded(false);
            }
          }}
          className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          disabled={isLoading}
        >
          <option value="">Consumidor final</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.fullName}
              {client.dni ? ` - DNI ${client.dni}` : client.phone ? ` - ${client.phone}` : ""}
            </option>
          ))}
        </select>
      </div>

      {!isCreating && (
        <div className={`mt-3 ${compact ? "flex justify-center" : "flex justify-end"}`}>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Nuevo cliente
          </button>
        </div>
      )}

      {isCreating && (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={newClientFirstName}
              onChange={(event) => setNewClientFirstName(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Nombre *"
              autoComplete="given-name"
            />
            <input
              type="text"
              value={newClientLastName}
              onChange={(event) => setNewClientLastName(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Apellido *"
              autoComplete="family-name"
            />
            <input
              type="text"
              value={newClientDni}
              onChange={(event) => setNewClientDni(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="DNI (opcional)"
              inputMode="numeric"
            />
            <input
              type="tel"
              value={newClientPhone}
              onChange={(event) => setNewClientPhone(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Telefono (opcional)"
              autoComplete="tel"
            />
            <input
              type="email"
              value={newClientEmail}
              onChange={(event) => setNewClientEmail(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
              placeholder="Email (opcional)"
              autoComplete="email"
            />
            <input
              type="text"
              value={newClientAddress}
              onChange={(event) => setNewClientAddress(event.target.value)}
              className="block w-full rounded-xl border border-slate-300 p-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:col-span-2"
              placeholder="Direccion (opcional)"
              autoComplete="street-address"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreateClient()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Guardar cliente
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
