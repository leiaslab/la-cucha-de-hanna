"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type AppRole, type AppUser } from "./db";
import {
  createAppUserRemote,
  deleteAppUserRemote,
  listAppUsersRemote,
  updateAppUserRemote,
} from "./src/lib/api-client";
import { showToast } from "./Toast";

interface UsersModalProps {
  currentUsername?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const initialFormState = {
  fullName: "",
  localeId: "",
  username: "",
  password: "",
  role: "cajero" as AppRole,
  canViewSalesCalendar: false,
};

export function UsersModal({ currentUsername, isOpen, onClose }: UsersModalProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState(initialFormState);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingUserId, setIsDeletingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const availableLocales = useLiveQuery(
    () => db.locals.orderBy("name").toArray(),
    [],
  );

  const sortUsers = (nextUsers: AppUser[]) =>
    nextUsers.slice().sort((a, b) => a.createdAt - b.createdAt);

  const resetForm = () => {
    setEditingUser(null);
    setForm(initialFormState);
    setIsActive(true);
    setError(null);
    setShowPassword(false);
  };

  const loadUsers = async () => {
    try {
      setUsers(await listAppUsersRemote());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      localeId: user.localeId ? String(user.localeId) : "",
      username: user.username,
      password: "",
      role: user.role,
      canViewSalesCalendar: user.canViewSalesCalendar,
    });
    setIsActive(user.isActive);
    setShowPassword(false);
    setError(null);
  };

  const handleResetPassword = (user: AppUser) => {
    handleEdit(user);
    showToast("Escribe una nueva clave y guarda para resetearla.", "success");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const localeId = Number(form.localeId);

    if (!Number.isFinite(localeId)) {
      setError("Selecciona un local para el usuario.");
      return;
    }

    setIsSaving(true);

    try {
      if (editingUser) {
        const updatedUser = await updateAppUserRemote(editingUser.id, {
          fullName: form.fullName,
          localeId,
          username: form.username,
          password: form.password.trim() || undefined,
          role: form.role,
          isActive,
          canViewSalesCalendar: form.canViewSalesCalendar,
        });
        setUsers((current) =>
          sortUsers(current.map((candidate) => (candidate.id === updatedUser.id ? updatedUser : candidate))),
        );
        showToast("Usuario actualizado con exito.", "success");
      } else {
        const createdUser = await createAppUserRemote({
          fullName: form.fullName,
          localeId,
          username: form.username,
          password: form.password,
          role: form.role,
          canViewSalesCalendar: form.canViewSalesCalendar,
        });
        setUsers((current) => sortUsers([...current, createdUser]));
        showToast("Usuario creado con exito.", "success");
      }

      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    if (currentUsername && user.username === currentUsername && user.isActive) {
      showToast("No puedes desactivar tu propio usuario.", "error");
      return;
    }

    try {
      const updated = await updateAppUserRemote(user.id, {
        isActive: !user.isActive,
      });
      setUsers((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
      if (editingUser?.id === updated.id) {
        setIsActive(updated.isActive);
      }
      showToast(`Usuario ${updated.isActive ? "activado" : "desactivado"} con exito.`, "success");
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No se pudo actualizar el estado.");
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (currentUsername && user.username === currentUsername) {
      showToast("No puedes borrar tu propio usuario.", "error");
      return;
    }

    if (!confirm(`Se borrara el usuario "${user.username}". Esta accion no se puede deshacer.`)) {
      return;
    }

    setError(null);
    setIsDeletingUserId(user.id);

    try {
      await deleteAppUserRemote(user.id);
      setUsers((current) => current.filter((candidate) => candidate.id !== user.id));
      if (editingUser?.id === user.id) {
        resetForm();
      }
      showToast("Usuario borrado con exito.", "success");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo borrar el usuario.");
    } finally {
      setIsDeletingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm sm:py-6">
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100vh-3rem)]">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Usuarios
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Los usuarios se asignan a un local, pero la creacion y administracion de locales se hace por separado.
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

        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Accesos cargados
              </h3>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-4">
              {isLoading ? (
                <p className="py-10 text-center text-slate-500 dark:text-slate-400">Cargando usuarios...</p>
              ) : users.length === 0 ? (
                <p className="py-10 text-center text-slate-500 dark:text-slate-400">
                  Todavia no hay usuarios cargados.
                </p>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {user.fullName}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            @{user.username}
                          </p>
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            {user.localeName ?? "Sin local"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${
                            user.role === "admin"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {user.isActive ? "Activo" : "Inactivo"}
                        </span>
                        {(user.role === "admin" || user.canViewSalesCalendar) && (
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            Calendario habilitado
                          </span>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(user)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                          >
                            Resetear clave
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(user)}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                          >
                            {user.isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(user)}
                            disabled={isDeletingUserId === user.id}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                          >
                            {isDeletingUserId === user.id ? "Borrando..." : "Borrar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {editingUser ? "Editar usuario" : "Nuevo usuario"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {editingUser
                ? "Actualiza nombre, rol, estado o cambia la clave si hace falta."
                : "Crea un acceso nuevo para otro local o computadora."}
            </p>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
              Para cambiar o recuperar una clave: entra en editar o usa resetear clave, escribe una nueva y guarda.
            </div>
            <form className="mt-5 space-y-4" onSubmit={handleSubmit} autoComplete="off" data-lpignore="true">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nombre
                </label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Local
                </label>
                <select
                  value={form.localeId}
                  onChange={(event) => setForm((current) => ({ ...current, localeId: event.target.value }))}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                >
                  <option value="">Selecciona un local</option>
                  {(availableLocales ?? []).map((locale) => (
                    <option key={locale.id} value={locale.id}>
                      {locale.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {availableLocales && availableLocales.length > 0
                    ? "El usuario quedara vinculado al local elegido."
                    : "Primero crea un local desde el menu Locales para poder asignarlo."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Usuario
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  {editingUser ? "Nueva clave (opcional)" : "Clave"}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    name="user-secret"
                    autoComplete="one-time-code"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-protonpass-ignore="true"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="shrink-0 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Minimo 4 caracteres. Puede ser solo numeros, por ejemplo 1234.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Rol
                </label>
                <select
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AppRole }))}
                  className="mt-1 block w-full rounded-xl border border-slate-300 p-3 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="cajero">Cajero</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {form.role === "cajero" && (
                <label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
                  <input
                    type="checkbox"
                    checked={form.canViewSalesCalendar}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        canViewSalesCalendar: event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-violet-300"
                  />
                  <span>
                    <span className="block font-bold">Ver calendario de ventas</span>
                    <span className="mt-1 block text-xs text-violet-700 dark:text-violet-300">
                      Permite consultar el resumen mensual y las ventas y gastos de cada dia.
                    </span>
                  </span>
                </label>
              )}

              {editingUser && (
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Usuario activo
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                {editingUser && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
