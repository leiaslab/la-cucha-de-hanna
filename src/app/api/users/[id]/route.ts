import { NextResponse } from "next/server";
import { deleteAppUser, MissingAppUsersTableError, updateAppUser } from "../../../../lib/app-users";
import { getCurrentSessionUser } from "../../../../lib/auth-server";
import { validatePasswordStrength } from "../../../../lib/auth";
import type { AppRole } from "../../../../lib/pos-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidRole(value: string): value is AppRole {
  return value === "admin" || value === "cajero";
}

export async function PATCH(request: Request, context: RouteContext<"/api/users/[id]">) {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede gestionar usuarios." }, { status: 403 });
  }

  try {
    const params = await context.params;
    const userId = Number(params.id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Usuario invalido." }, { status: 400 });
    }

    const body = (await request.json()) as {
      fullName?: string;
      isActive?: boolean;
      localeId?: number;
      password?: string;
      role?: string;
      username?: string;
      canViewSalesCalendar?: boolean;
    };

    if (sessionUser.id === userId && body.isActive === false) {
      return NextResponse.json({ error: "No puedes desactivar tu propio usuario." }, { status: 400 });
    }

    if (body.role !== undefined && !isValidRole(body.role)) {
      return NextResponse.json({ error: "Selecciona un rol valido." }, { status: 400 });
    }

    if (
      body.canViewSalesCalendar !== undefined &&
      typeof body.canViewSalesCalendar !== "boolean"
    ) {
      return NextResponse.json({ error: "El permiso de calendario es invalido." }, { status: 400 });
    }

    if (body.password !== undefined && body.password.trim() !== "") {
      const passwordError = validatePasswordStrength(body.password.trim());
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }
    }

    const updated = await updateAppUser(userId, {
      fullName: body.fullName,
      isActive: body.isActive,
      localeId: body.localeId,
      password: body.password,
      role: body.role,
      username: body.username,
      canViewSalesCalendar: body.canViewSalesCalendar,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message =
      error instanceof MissingAppUsersTableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo actualizar el usuario.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/users/[id]">) {
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Solo el admin puede gestionar usuarios." }, { status: 403 });
  }

  try {
    const params = await context.params;
    const userId = Number(params.id);

    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: "Usuario invalido." }, { status: 400 });
    }

    if (sessionUser.id === userId) {
      return NextResponse.json({ error: "No puedes borrar tu propio usuario." }, { status: 400 });
    }

    await deleteAppUser(userId);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    const message =
      error instanceof MissingAppUsersTableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo borrar el usuario.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
