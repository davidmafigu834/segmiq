import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const PORTAL_COOKIE = "segmiq_portal";

function pepper() {
  return process.env.NEXTAUTH_SECRET || process.env.PORTAL_PEPPER || "segmiq-portal-dev";
}

export function hashPortalSecret(value: string) {
  return createHmac("sha256", pepper()).update(value).digest("hex");
}

export function portalSecretsMatch(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newPortalToken() {
  return randomBytes(32).toString("hex");
}

export function newOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function portalOriginOk(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function readPortalCookie() {
  return cookies().get(PORTAL_COOKIE)?.value ?? null;
}

export function writePortalCookie(token: string, expires: Date) {
  cookies().set(PORTAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export function clearPortalCookie() {
  cookies().set(PORTAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
