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
  created_at: string;
  updated_at: string;
};

const USERS_TABLE = "app_users";
const PUBLIC_USER_COLUMNS = "id,full_name,username,role,is_active,created_at,updated_at";

export class MissingAppUsersTableError extends Error {
  constructor() {
    super("Debes ejecutar la actualizacion de Supabase para habilitar usuarios.");
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === "42P01" ||
    (error?.message?.toLowerCase().includes("app_users") &&
      error.message.toLowerCase().includes("does not exist"))
  );
}

function mapAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapSessionUser(row: AppUserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    source: "database",
  };
}

export async function authenticateAppUser(username: string, password: string) {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedUsername = normalizeUsername(username);
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select("id,full_name,username,password_hash,role,is_active,created_at,updated_at")
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
  const payload = {
    full_name: input.fullName.trim(),
    username: normalizeUsername(input.username),
    password_hash: hashPassword(input.password.trim()),
    role: input.role,
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
  const payload: Record<string, string | boolean> = {};

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
