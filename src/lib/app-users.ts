import "server-only";

import { normalizeUsername } from "./auth";
import { hashPassword, verifyPassword } from "./auth-server";
import type { AppRole, AppUser, AppUserInput, AppUserUpdateInput, SessionUser } from "./pos-types";
import { createServiceRoleSupabaseClient } from "./supabase/server";

type AppUserRow = {
  id: number;
  full_name: string;
  username: string;
  password_hash: string;
  role: AppRole;
  is_active: boolean;
  locale_id: number | null;
  created_at: string;
  updated_at: string;
  locales?: { name: string } | { name: string }[] | null;
};

const USERS_TABLE = "app_users";
const PUBLIC_USER_COLUMNS =
  "id,full_name,username,role,is_active,locale_id,created_at,updated_at,locales(name)";

export class MissingAppUsersTableError extends Error {
  constructor() {
    super("Debes ejecutar la actualizacion de Supabase para habilitar usuarios.");
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    ((error?.message?.toLowerCase().includes("app_users") ||
      error?.message?.toLowerCase().includes("locales")) &&
      error.message.toLowerCase().includes("does not exist"))
  );
}

function mapAppUser(row: AppUserRow): AppUser {
  const locale = Array.isArray(row.locales) ? row.locales[0] : row.locales;

  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    localeId: row.locale_id ?? undefined,
    localeName: locale?.name ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapSessionUser(row: AppUserRow): SessionUser {
  const locale = Array.isArray(row.locales) ? row.locales[0] : row.locales;

  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    localId: row.locale_id,
    localName: locale?.name ?? undefined,
    source: "database",
  };
}

async function resolveLocaleIdByName(localeName: string) {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedName = localeName.trim();

  if (!normalizedName) {
    throw new Error("Debes indicar un local.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("locales")
    .select("id,name")
    .ilike("name", normalizedName)
    .limit(1)
    .maybeSingle<{ id: number; name: string }>();

  if (existingError) {
    if (isMissingTableError(existingError)) {
      throw new MissingAppUsersTableError();
    }

    throw new Error(existingError.message);
  }

  if (existing) {
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("locales")
    .insert({ name: normalizedName })
    .select("id")
    .single<{ id: number }>();

  if (createError) {
    throw new Error(createError.message);
  }

  const { data: products, error: productsError } = await supabase
    .from("productos")
    .select("id, low_stock_alert_threshold");

  if (productsError) {
    throw new Error(productsError.message);
  }

  if ((products ?? []).length > 0) {
    const { error: stockSeedError } = await supabase.from("productos_stock_local").insert(
      (products ?? []).map((product) => ({
        product_id: product.id,
        local_id: created.id,
        stock: 0,
        low_stock_alert_threshold: product.low_stock_alert_threshold ?? 5,
      })),
    );

    if (stockSeedError) {
      throw new Error(stockSeedError.message);
    }
  }

  return created.id;
}

export async function authenticateAppUser(username: string, password: string) {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedUsername = normalizeUsername(username);
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("id,full_name,username,password_hash,role,is_active,locale_id,created_at,updated_at,locales(name)")
    .eq("username", normalizedUsername)
    .maybeSingle<AppUserRow>();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  if (!data || !data.is_active || !verifyPassword(password.trim(), data.password_hash)) {
    return null;
  }

  return mapSessionUser(data);
}

export async function listAppUsers() {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(PUBLIC_USER_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAppUsersTableError();
    }

    throw new Error(error.message);
  }

  return (data as AppUserRow[]).map(mapAppUser);
}

export async function createAppUser(input: AppUserInput) {
  const supabase = createServiceRoleSupabaseClient();
  const localeId = await resolveLocaleIdByName(input.localeName);
  const payload = {
    full_name: input.fullName.trim(),
    username: normalizeUsername(input.username),
    password_hash: hashPassword(input.password.trim()),
    role: input.role,
    locale_id: localeId,
  };

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .insert(payload)
    .select(PUBLIC_USER_COLUMNS)
    .single<AppUserRow>();

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAppUsersTableError();
    }

    throw new Error(error.message);
  }

  return mapAppUser(data);
}

export async function updateAppUser(userId: number, input: AppUserUpdateInput) {
  const supabase = createServiceRoleSupabaseClient();
  const payload: Record<string, string | boolean | number> = {};

  if (input.fullName !== undefined) {
    payload.full_name = input.fullName.trim();
  }

  if (input.username !== undefined) {
    payload.username = normalizeUsername(input.username);
  }

  if (input.role !== undefined) {
    payload.role = input.role;
  }

  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }

  if (input.localeName !== undefined) {
    payload.locale_id = await resolveLocaleIdByName(input.localeName);
  }

  if (input.password && input.password.trim()) {
    payload.password_hash = hashPassword(input.password.trim());
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .update(payload)
    .eq("id", userId)
    .select(PUBLIC_USER_COLUMNS)
    .single<AppUserRow>();

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAppUsersTableError();
    }

    throw new Error(error.message);
  }

  return mapAppUser(data);
}

export async function deleteAppUser(userId: number) {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from(USERS_TABLE).delete().eq("id", userId);

  if (error) {
    if (isMissingTableError(error)) {
      throw new MissingAppUsersTableError();
    }

    throw new Error(error.message);
  }
}
