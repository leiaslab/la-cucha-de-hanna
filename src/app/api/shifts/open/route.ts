import { NextResponse } from "next/server";
import type { ShiftOpenInput } from "../../../../lib/pos-types";
import { openShift } from "../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ShiftOpenInput;
    const shift = await openShift(payload);
    return NextResponse.json({ data: shift }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo abrir el turno.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
