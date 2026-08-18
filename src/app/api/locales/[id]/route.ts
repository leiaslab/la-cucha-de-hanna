import { NextResponse } from "next/server";
import type { LocalUpdateInput } from "../../../../lib/pos-types";
import { deleteLocal, updateLocal } from "../../../../lib/pos-service";
import { requireAdminUser } from "../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext<"/api/locales/[id]">) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const localId = Number(params.id);

    if (!Number.isFinite(localId)) {
      return NextResponse.json({ error: "Local invalido." }, { status: 400 });
    }

    const body = (await request.json()) as LocalUpdateInput;
    const updated = await updateLocal(localId, {
      name: typeof body.name === "string" ? body.name : undefined,
      logoUrl:
        body.logoUrl === null || typeof body.logoUrl === "string"
          ? body.logoUrl
          : undefined,
      thermalPrinterEnabled: body.thermalPrinterEnabled,
      stockControlEnabled: body.stockControlEnabled,
      productIds: Array.isArray(body.productIds) ? body.productIds : undefined,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar el local.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/locales/[id]">) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const params = await context.params;
    const localId = Number(params.id);

    if (!Number.isFinite(localId)) {
      return NextResponse.json({ error: "Local invalido." }, { status: 400 });
    }

    await deleteLocal(localId);
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo borrar el local.",
      },
      { status: 400 },
    );
  }
}
