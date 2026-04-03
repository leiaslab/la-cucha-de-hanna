import { NextResponse } from "next/server";
import type { CheckoutPayload } from "../../../../lib/pos-types";
import { createCheckout } from "../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as CheckoutPayload;
    const result = await createCheckout(payload, auth.user);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo registrar la venta.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
