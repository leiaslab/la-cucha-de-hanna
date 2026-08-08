import { NextResponse } from "next/server";
import { getProductImageSource } from "../../../../../lib/pos-service";
import { requireAuthenticatedUser } from "../../../../../lib/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "private, max-age=86400, stale-while-revalidate=604800";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthenticatedUser();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const imageSource = await getProductImageSource(Number(id));

    if (!imageSource) {
      return new NextResponse(null, { status: 404 });
    }

    if (!imageSource.startsWith("data:")) {
      return NextResponse.redirect(imageSource, {
        headers: { "Cache-Control": CACHE_CONTROL },
      });
    }

    const match = imageSource.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) {
      return new NextResponse(null, { status: 415 });
    }

    return new NextResponse(Buffer.from(match[2], "base64"), {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "Content-Type": match[1],
        "Content-Length": String(Buffer.byteLength(match[2], "base64")),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
