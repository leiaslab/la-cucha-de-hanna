import { NextResponse } from "next/server";
import type { ProductInput } from "../../../../lib/pos-types";
import { deleteProduct, updateProduct } from "../../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as ProductInput;
    const product = await updateProduct(Number(id), payload);
    return NextResponse.json({ data: product });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el producto.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await context.params;
    await deleteProduct(Number(id));
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar el producto.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
