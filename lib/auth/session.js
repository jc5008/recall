import crypto from "node:crypto";

const USER_SESSION_COOKIE = "user_session";
const USER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createUserSessionToken({ userId, email, role = "user" }) {
  const payload = {
    userId,
    email,
    role,
    exp: Math.floor(Date.now() / 1000) + USER_SESSION_DURATION_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = sign(encoded, getSecret());
  return `${encoded}.${signature}`;
}

export function verifyUserSessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "invalid_token" };
  }

  const [encoded, providedSig] = token.split(".");
  if (!encoded || !providedSig) {
    return { ok: false, reason: "invalid_token_format" };
  }

  const expectedSig = sign(encoded, getSecret());
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload;
  try {
    payload = JSON.parse(decode(encoded));
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || payload.exp < now) {
    return { ok: false, reason: "expired_token" };
  }

  return { ok: true, payload };
}

export function getUserSessionCookieName() {
  return USER_SESSION_COOKIE;
}

export function getUserSessionMaxAgeSeconds() {
  return USER_SESSION_DURATION_SECONDS;
}
