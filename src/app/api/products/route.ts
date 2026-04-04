import { NextResponse } from "next/server";
import type { ProductInput } from "../../../lib/pos-types";
import { createProduct, replaceProducts } from "../../../lib/pos-service";
import { requireAdminUser } from "../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const payload = (await request.json()) as ProductInput;
    const product = await createProduct(payload, auth.user);
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear el producto.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response || !auth.user) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { products?: ProductInput[] };
    const products = await replaceProducts(body.products ?? [], auth.user);
    return NextResponse.json({ data: products });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo reemplazar el catalogo.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
