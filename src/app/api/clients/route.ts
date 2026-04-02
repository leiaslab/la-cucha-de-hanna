import { NextResponse } from "next/server";
import type { ClientRecord } from "../../../lib/pos-types";
import { createClient, listClients } from "../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clients = await listClients();
    return NextResponse.json({ data: clients });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo listar los clientes.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Omit<ClientRecord, "id" | "createdAt" | "updatedAt">;
    const client = await createClient(payload);
    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear el cliente.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
