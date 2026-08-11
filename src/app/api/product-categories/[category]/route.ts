import { NextResponse } from "next/server";
import { deleteProductCategory, moveProductCategory } from "../../../../lib/pos-service";
import { requireAdminUser } from "../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/product-categories/[category]">,
) {
  const auth = await requireAdminUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { category } = await context.params;
    const body = (await request.json()) as { targetCategory?: string };
    const updatedCount = await moveProductCategory(category, body.targetCategory ?? "");
    return NextResponse.json({ data: { updatedCount } });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo mover la categoria.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/product-categories/[category]">,
) {
  const auth = await requireAdminUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { category } = await context.params;
    const deletedCount = await deleteProductCategory(category);
    return NextResponse.json({ data: { deletedCount } });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar la categoria.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
