import "server-only";

import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "./auth-server";

export async function requireAuthenticatedUser() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export async function requireAdminUser() {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth;
  }

  if (auth.user.role !== "admin") {
    return {
      user: auth.user,
      response: NextResponse.json(
        { error: "Solo el admin puede realizar esta accion." },
        { status: 403 },
      ),
    };
  }

  return {
    user: auth.user,
    response: null,
  };
}
