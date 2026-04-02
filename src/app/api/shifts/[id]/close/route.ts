import { NextResponse } from "next/server";
import type { ShiftCloseInput } from "../../../../../lib/pos-types";
import { closeShift } from "../../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/shifts/[id]/close">) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ShiftCloseInput;
    const result = await closeShift(Number(id), payload);
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
