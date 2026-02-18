import { getAdminSessionCookieName, verifyAdminSessionToken } from "./session";

export function requireAdminSession(request) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return {
      ok: false,
      status: 500,
      message: "ADMIN_SESSION_SECRET is not configured.",
    };
  }

  const cookieName = getAdminSessionCookieName();
  const token = request.cookies?.get(cookieName)?.value;
  const verification = verifyAdminSessionToken(token);

  if (!verification.ok) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
    };
  }

  return { ok: true };
}
