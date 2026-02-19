import { NextResponse } from "next/server";
import { getUserSessionCookieName, verifyUserSessionToken } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const token = request.cookies.get(getUserSessionCookieName())?.value;
    const result = verifyUserSessionToken(token);
    if (!result.ok) {
      return NextResponse.json({ ok: true, authenticated: false, user: null });
    }
    const { userId, email, role } = result.payload;
    const isAnonymous = role === "anonymous" && !userId;
    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: { userId, email, role, isAnonymous },
    });
  } catch {
    return NextResponse.json({ ok: true, authenticated: false, user: null });
  }
}
