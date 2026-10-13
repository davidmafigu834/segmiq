import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { credentialsConflict } from "@/lib/demo/allowlist";
import { readDemoSessionCookie } from "@/lib/demo/cookie";
import { bindGuest, guestToSession, loadGuestBySecret } from "@/lib/demo/guest-session";

export type OperationalSession = Session & { demoGuest?: boolean };

/**
 * Production NextAuth session, or a demo guest session.
 * A request that presents both is refused.
 */
export async function getOperationalSession(cookieHeader?: string | null): Promise<OperationalSession | null> {
  const next = await getServerSession(authOptions);
  const header = cookieHeader === undefined ? cookies().get("segmiq_demo_session")?.value ?? null : readDemoSessionCookie(cookieHeader);
  const demoSecret = cookieHeader === undefined ? header : header;
  if (credentialsConflict(Boolean(next?.userId), Boolean(demoSecret))) return null;
  if (next?.userId) return next;
  if (!demoSecret) return null;
  const guest = await loadGuestBySecret(demoSecret);
  if (!guest) return null;
  bindGuest(guest);
  return guestToSession(guest);
}
