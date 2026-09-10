import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import type { ClientMode, UserRole } from "@/types";
import { JWT_MAX_AGE_SEC } from "@/lib/auth/session-policy";

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    domain:
      process.env.NODE_ENV === "production"
        ? "." +
          (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "segmiq.com")
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
            .split(":")[0]
        : undefined,
    maxAge: JWT_MAX_AGE_SEC,
  };
}

export type SessionTokenPayload = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  clientMode: ClientMode;
  alsoSells?: boolean;
  sessionVersion: number;
  sessionId: string;
  email: string | null;
  name: string;
  realUserId?: string | null;
  realUserName?: string | null;
};

export async function setSessionToken(payload: SessionTokenPayload): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");

  const token = await encode({
    token: {
      userId: payload.userId,
      role: payload.role,
      clientId: payload.clientId,
      clientMode: payload.clientMode,
      alsoSells: Boolean(payload.alsoSells),
      sessionVersion: payload.sessionVersion,
      sessionId: payload.sessionId,
      email: payload.email,
      name: payload.name,
      sub: payload.userId,
      realUserId: payload.realUserId ?? null,
      realUserName: payload.realUserName ?? null,
    },
    secret,
    maxAge: JWT_MAX_AGE_SEC,
  });

  cookies().set(getSessionCookieName(), token, getSessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  cookies().set(getSessionCookieName(), "", { ...getSessionCookieOptions(), maxAge: 0 });
}
