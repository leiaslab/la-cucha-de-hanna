import { NextResponse } from "next/server";
import type { ShiftCloseInput } from "../../../../../lib/pos-types";
import { closeShiftForUser } from "../../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/shifts/[id]/close">) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ShiftCloseInput;
    const result = await closeShiftForUser(Number(id), payload, auth.user);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cerrar el turno.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
