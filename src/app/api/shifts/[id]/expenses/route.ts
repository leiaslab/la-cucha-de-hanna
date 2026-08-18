import { NextResponse } from "next/server";
import type { ShiftExpenseInput } from "../../../../../lib/pos-types";
import { registerShiftExpenseForUser } from "../../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ShiftExpenseInput;
    const result = await registerShiftExpenseForUser(Number(id), payload, auth.user);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo registrar el gasto.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
