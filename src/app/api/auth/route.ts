import { NextResponse } from "next/server";
import { authenticateAppUser } from "../../../lib/app-users";
import { normalizeUsername } from "../../../lib/auth";
import {
  authenticateFallbackAdmin,
  clearCurrentSessionUser,
  getCurrentSessionUser,
  setCurrentSessionUser,
} from "../../../lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentSessionUser();

  return NextResponse.json({ data: { authenticated: Boolean(user), user } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const normalizedUsername = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";
    const user =
      (await authenticateAppUser(normalizedUsername, password)) ??
      authenticateFallbackAdmin(normalizedUsername, password);

    if (!user) {
      return NextResponse.json(
        { error: "Usuario o clave incorrectos." },
        { status: 401 },
      );
    }

    await setCurrentSessionUser(user);

    return NextResponse.json({ data: { authenticated: true, user } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo iniciar sesion.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await clearCurrentSessionUser();

  return NextResponse.json({ data: { success: true } });
}
