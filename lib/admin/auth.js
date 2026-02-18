import { getAdminSessionCookieName, verifyAdminSessionToken } from "./session";
import { getUserSessionCookieName, verifyUserSessionToken } from "../auth/session";

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
    const userToken = request.cookies?.get(getUserSessionCookieName())?.value;
    const userVerification = verifyUserSessionToken(userToken);
    if (userVerification.ok && userVerification.payload?.role === "admin") {
      return { ok: true };
    }

    return {
      ok: false,
      status: 401,
      message: "Unauthorized.",
    };
  }

  return { ok: true };
}
