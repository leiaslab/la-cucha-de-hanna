import { NextResponse } from "next/server";
import type { ClientRecord } from "../../../../lib/pos-types";
import { deleteClient, updateClient } from "../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext<"/api/clients/[id]">) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Omit<ClientRecord, "id" | "createdAt" | "updatedAt">;
    const client = await updateClient(Number(id), payload);
    return NextResponse.json({ data: client });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el cliente.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/clients/[id]">) {
  try {
    const { id } = await context.params;
    await deleteClient(Number(id));
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar el cliente.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
