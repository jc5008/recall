import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
} from "../../../../lib/admin/session";

export const runtime = "nodejs";

function isValidAdminPassword(password) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return false;
  if (typeof password !== "string") return false;

  const a = Buffer.from(password);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const password = body?.password;

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_PASSWORD is not configured." },
        { status: 500 },
      );
    }
    if (!process.env.ADMIN_SESSION_SECRET) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_SESSION_SECRET is not configured." },
        { status: 500 },
      );
    }

    if (!isValidAdminPassword(password)) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const token = createAdminSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: getAdminSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAdminSessionMaxAgeSeconds(),
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
