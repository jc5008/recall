import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "../../../../lib/db/client";
import { hashPassword } from "../../../../lib/auth/password";
import {
  createUserSessionToken,
  getUserSessionCookieName,
  getUserSessionMaxAgeSeconds,
} from "../../../../lib/auth/session";

export const runtime = "nodejs";

function createUserId() {
  return `user_${randomUUID()}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const displayName = String(body?.displayName ?? "").trim() || null;

    if (!process.env.AUTH_SESSION_SECRET) {
      return NextResponse.json(
        { ok: false, error: "AUTH_SESSION_SECRET is not configured." },
        { status: 500 },
      );
    }

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Email and password (8+ chars) are required." },
        { status: 400 },
      );
    }

    const userId = createUserId();
    const passwordHash = hashPassword(password);

    const insert = await query(
      `
        INSERT INTO users (user_id, email, password_hash, role, display_name)
        VALUES ($1, $2, $3, 'user', $4)
        ON CONFLICT (email) DO NOTHING
        RETURNING user_id, email, role
      `,
      [userId, email, passwordHash, displayName],
    );

    if (!insert.rowCount) {
      return NextResponse.json({ ok: false, error: "Email is already in use." }, { status: 409 });
    }

    const user = insert.rows[0];
    const token = createUserSessionToken({
      userId: user.user_id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({ ok: true, user: { userId: user.user_id, email } });
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
