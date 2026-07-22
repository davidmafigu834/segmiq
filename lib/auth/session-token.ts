import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import type { ClientMode, UserRole } from "@/types";

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
    maxAge: 30 * 24 * 60 * 60,
  };
}

export type SessionTokenPayload = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  clientMode: ClientMode;
  alsoSells?: boolean;
  sessionVersion: number;
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
      email: payload.email,
      name: payload.name,
      sub: payload.userId,
      realUserId: payload.realUserId ?? null,
      realUserName: payload.realUserName ?? null,
    },
    secret,
    maxAge: 30 * 24 * 60 * 60,
  });

  cookies().set(getSessionCookieName(), token, getSessionCookieOptions());
}
