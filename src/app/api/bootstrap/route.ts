import { NextResponse } from "next/server";
import { getBootstrapSnapshot } from "../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getBootstrapSnapshot();
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo obtener el snapshot remoto.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
