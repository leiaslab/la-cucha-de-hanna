import { NextResponse } from "next/server";
import { authenticateAppUser } from "../../../../lib/app-users";
import { authenticateFallbackAdmin } from "../../../../lib/auth-server";
import type { SalesResetInput } from "../../../../lib/pos-types";
import { resetSalesData } from "../../../../lib/pos-service";
import { requireAdminUser } from "../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidDateString(value: string | undefined) {
  return Boolean(value) && !Number.isNaN(Date.parse(value ?? ""));
}

async function verifyAdminPassword(username: string, password: string, userId: number | null) {
  const fallbackUser = authenticateFallbackAdmin(username, password);
  if (fallbackUser) {
    return true;
  }

  const appUser = await authenticateAppUser(username, password);
  if (!appUser) {
    return false;
  }

  return appUser.role === "admin" && appUser.id === userId;
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as SalesResetInput;
    const scope = payload.scope;
    const adminPassword = payload.adminPassword?.trim() ?? "";

    if (scope !== "day" && scope !== "month" && scope !== "all") {
      return NextResponse.json({ error: "El alcance del borrado no es valido." }, { status: 400 });
    }

    if (!adminPassword) {
      return NextResponse.json({ error: "Debes ingresar la clave del admin para confirmar." }, { status: 400 });
    }

    if (scope !== "all" && (!isValidDateString(payload.startsAt) || !isValidDateString(payload.endsAt))) {
      return NextResponse.json({ error: "Debes enviar un rango de fechas valido." }, { status: 400 });
    }

    const isValidAdminPassword = await verifyAdminPassword(
      auth.user.username,
      adminPassword,
      auth.user.id ?? null,
    );

    if (!isValidAdminPassword) {
      return NextResponse.json({ error: "La clave del admin no es correcta." }, { status: 401 });
    }

    const result = await resetSalesData(payload);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron borrar las ventas.",
      },
      { status: 400 },
    );
  }
}
