import { NextResponse } from "next/server";
import type { ShiftOpenInput } from "../../../../lib/pos-types";
import { openShiftForUser } from "../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as ShiftOpenInput;
    const shift = await openShiftForUser(payload, auth.user);
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
