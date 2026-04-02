import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);

  return NextResponse.json({ data: { success: true } });
}
