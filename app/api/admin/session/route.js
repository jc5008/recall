import { NextResponse } from "next/server";
import { requireAdminSession } from "../../../../lib/admin/auth";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireAdminSession(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, authenticated: true });
}
