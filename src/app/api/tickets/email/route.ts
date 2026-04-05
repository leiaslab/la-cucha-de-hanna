import { NextResponse } from "next/server";
import type { TicketEmailPayload } from "../../../../lib/pos-types";
import { requireAuthenticatedUser } from "../../../../lib/route-auth";
import { sendTicketEmail } from "../../../../lib/ticket-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as TicketEmailPayload;
    const result = await sendTicketEmail(payload);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo enviar el ticket por mail.",
      },
      { status: 400 },
    );
  }
}
