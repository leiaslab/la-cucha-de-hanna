import { NextResponse } from "next/server";
import type { ProductInput } from "../../../lib/pos-types";
import { createProduct, replaceProducts } from "../../../lib/pos-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProductInput;
    const product = await createProduct(payload);
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
  try {
    const body = (await request.json()) as { products?: ProductInput[] };
    const products = await replaceProducts(body.products ?? []);
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
