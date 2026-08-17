import { NextResponse } from "next/server";
import type { LocalCreateInput } from "../../../lib/pos-types";
import { createLocal } from "../../../lib/pos-service";
import { requireAdminUser } from "../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as LocalCreateInput;
    const local = await createLocal({
      name: body.name ?? "",
      thermalPrinterEnabled: body.thermalPrinterEnabled,
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
    });
    return NextResponse.json({ data: local }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear el local.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
