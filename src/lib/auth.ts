import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "fyrax_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export async function createSession() {
  const expires = String(Date.now() + MAX_AGE_SECONDS * 1000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function isAuthenticated() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;

  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!safeEqual(signature, sign(expires))) return false;

  return Number(expires) > Date.now();
}
