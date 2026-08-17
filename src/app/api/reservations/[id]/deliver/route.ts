import { NextResponse } from "next/server";
import { deliverReservationPlan } from "../../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/reservations/[id]/deliver">,
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const plan = await deliverReservationPlan(Number(id), auth.user);
    return NextResponse.json({ data: plan });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo marcar el producto como entregado.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
