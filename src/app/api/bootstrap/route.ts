import { NextResponse } from "next/server";
import { getBootstrapSnapshot } from "../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const snapshot = await getBootstrapSnapshot(auth.user);
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
