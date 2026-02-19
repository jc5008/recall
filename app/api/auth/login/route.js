import { NextResponse } from "next/server";
import { query } from "../../../../lib/db/client";
import { verifyPassword } from "../../../../lib/auth/password";
import {
  createUserSessionToken,
  getUserSessionCookieName,
  getUserSessionMaxAgeSeconds,
} from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!process.env.AUTH_SESSION_SECRET) {
      return NextResponse.json(
        { ok: false, error: "AUTH_SESSION_SECRET is not configured." },
        { status: 500 },
      );
    }

    if (!password) {
      return NextResponse.json({ ok: false, error: "Password required." }, { status: 400 });
    }

    // Anonymous: no username, password must match ANONYMOUS_PASSWORD
    if (!email) {
      const configuredPassword = String(process.env.ANONYMOUS_PASSWORD ?? "");
      if (!configuredPassword) {
        return NextResponse.json(
          { ok: false, error: "ANONYMOUS_PASSWORD is not configured." },
          { status: 500 },
        );
      }
      if (password !== configuredPassword) {
        return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
      }

      const token = createUserSessionToken({
        userId: null,
        email: null,
        role: "anonymous",
      });

      const response = NextResponse.json({
        ok: true,
        user: { userId: null, email: null, role: "anonymous", isAnonymous: true },
      });
      response.cookies.set({
        name: getUserSessionCookieName(),
        value: token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: getUserSessionMaxAgeSeconds(),
      });
      return response;
    }

    const result = await query(
      "SELECT user_id, email, role, password_hash FROM users WHERE email = $1 LIMIT 1",
      [email],
    );

    if (!result.rowCount) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const user = result.rows[0];
    const valid = verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const token = createUserSessionToken({
      userId: user.user_id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      ok: true,
      user: { userId: user.user_id, email: user.email, role: user.role },
    });
    response.cookies.set({
      name: getUserSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getUserSessionMaxAgeSeconds(),
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
