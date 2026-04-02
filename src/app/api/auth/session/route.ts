import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const authenticated = cookieStore.get(APP_SESSION_COOKIE)?.value === "authenticated";

  return NextResponse.json({ data: { authenticated } });
}
