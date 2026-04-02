import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE, getAppLoginCredentials } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const credentials = getAppLoginCredentials();

    if (
      body.username?.trim() !== credentials.username.trim() ||
      body.password !== credentials.password
    ) {
      return NextResponse.json(
        { error: "Usuario o clave incorrectos." },
        { status: 401 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(APP_SESSION_COOKIE, "authenticated", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({ data: { authenticated: true } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo iniciar sesion.",
      },
      { status: 400 },
    );
  }
}
