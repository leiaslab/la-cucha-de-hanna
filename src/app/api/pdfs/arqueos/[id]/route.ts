import { NextResponse } from "next/server";
import { generateShiftPdf } from "../../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/pdfs/arqueos/[id]">) {
  try {
    const { id } = await context.params;
    const result = await generateShiftPdf(Number(id));
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo generar el PDF del arqueo.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
