import { NextResponse } from "next/server";
import { createAppUser, listAppUsers, MissingAppUsersTableError } from "../../../lib/app-users";
import { getCurrentSessionUser } from "../../../lib/auth-server";
import { validatePasswordStrength } from "../../../lib/auth";
import type { AppRole } from "../../../lib/pos-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ensureAdmin(user: Awaited<ReturnType<typeof getCurrentSessionUser>>) {
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede gestionar usuarios." }, { status: 403 });
  }

  return null;
}

function isValidRole(value: string): value is AppRole {
  return value === "admin" || value === "cajero";
}

export async function GET() {
  const user = await getCurrentSessionUser();
  const authError = ensureAdmin(user);
  if (authError) {
    return authError;
  }

  try {
    const users = await listAppUsers();
    return NextResponse.json({ data: users });
  } catch (error) {
    const message =
      error instanceof MissingAppUsersTableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron listar los usuarios.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentSessionUser();
  const authError = ensureAdmin(user);
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as {
      fullName?: string;
      localeId?: number;
      password?: string;
      role?: string;
      username?: string;
    };

    const fullName = body.fullName?.trim() ?? "";
    const username = body.username?.trim() ?? "";
    const password = body.password?.trim() ?? "";
    const role = body.role ?? "";
    const localeId = Number(body.localeId);

    if (!fullName || !username || !password || !Number.isFinite(localeId)) {
      return NextResponse.json({ error: "Completa nombre, local, usuario y clave." }, { status: 400 });
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (!isValidRole(role)) {
      return NextResponse.json({ error: "Selecciona un rol valido." }, { status: 400 });
    }

    const created = await createAppUser({
      fullName,
      localeId,
      username,
      password,
      role,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof MissingAppUsersTableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo crear el usuario.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
