import { NextResponse } from "next/server";
import type { ReservationCreateInput } from "../../../lib/pos-types";
import { createReservationPlan, listReservationPlans } from "../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const plans = await listReservationPlans(auth.user);
    return NextResponse.json({ data: plans });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar los planes de reserva.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as ReservationCreateInput;
    const result = await createReservationPlan(payload, auth.user);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear el plan de reserva.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
