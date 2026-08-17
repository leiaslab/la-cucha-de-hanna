import { NextResponse } from "next/server";
import type { ReservationPaymentInput } from "../../../../../lib/pos-types";
import { addReservationPayment } from "../../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: RouteContext<"/api/reservations/[id]/payments">,
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ReservationPaymentInput;
    const result = await addReservationPayment(Number(id), payload, auth.user);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo registrar el pago.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
