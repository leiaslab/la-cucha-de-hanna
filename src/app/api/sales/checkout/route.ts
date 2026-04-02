import { NextResponse } from "next/server";
import type { CheckoutPayload } from "../../../../lib/pos-types";
import { createCheckout } from "../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CheckoutPayload;
    const result = await createCheckout(payload);
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
