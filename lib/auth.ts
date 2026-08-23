import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/password";
import { fetchAuthUserByEmail, fetchClientMode } from "@/lib/supabase/auth-rest";
import type { ClientMode, UserRole } from "@/types";

export class AuthDatabaseUnavailableError extends Error {
  constructor(message = "DatabaseUnavailable") {
    super(message);
    this.name = "AuthDatabaseUnavailableError";
  }
}

export async function resolveClientMode(clientId: string | null): Promise<ClientMode> {
  if (!clientId) return "team";
  return fetchClientMode(clientId);
}

export type VerifiedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  clientMode: ClientMode;
  alsoSells: boolean;
  sessionVersion: number;
};

/** Shared credential check used by NextAuth and the field-app bearer token endpoint. */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const lookup = await fetchAuthUserByEmail(normalizedEmail);
  const dev = process.env.NODE_ENV === "development";
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "(missing NEXT_PUBLIC_SUPABASE_URL)";
    } catch {
      return "(invalid NEXT_PUBLIC_SUPABASE_URL)";
    }
  })();

  if (!lookup.ok) {
    if (lookup.reason === "not_found") {
      if (dev) {
        console.error(
          "[auth] No row in public.users for",
          JSON.stringify(normalizedEmail),
          "— app is using Supabase host:",
          supabaseHost
        );
      }
      return null;
    }
    console.error("[auth] Supabase user lookup failed:", {
      reason: lookup.reason,
      status: lookup.status,
      detail: lookup.detail,
      host: supabaseHost,
    });
    throw new AuthDatabaseUnavailableError();
  }

  const user = lookup.row;
  if (!user.is_active) {
    if (dev) console.warn("[auth] User inactive:", normalizedEmail);
    return null;
  }
  const hash = String(user.password ?? "").trim();
  const ok = await verifyPassword(password, hash);
  if (!ok && dev) console.error("[auth] Password did not match stored hash for:", normalizedEmail);
  if (!ok) return null;

  const clientId = user.client_id ?? null;
  // Default to team if the follow-up read is slow — login must not 504 while PostgREST recovers.
  const clientMode = clientId ? await fetchClientMode(clientId) : "team";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    clientId,
    clientMode,
    alsoSells: Boolean(user.also_sells),
    sessionVersion: Number(user.session_version ?? 0),
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return verifyCredentials(credentials.email, credentials.password);
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
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
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.clientId = user.clientId ?? null;
        token.clientMode = (user as { clientMode?: ClientMode }).clientMode ?? "team";
        token.alsoSells = Boolean((user as { alsoSells?: boolean }).alsoSells);
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        token.email = (user as { email?: string | null }).email ?? null;
        token.name = (user as { name?: string | null }).name ?? null;
        token.realUserId = null;
        token.realUserName = null;
      }
      if ((token.role as string) === "AGENCY_ADMIN") {
        token.role = "SUPER_ADMIN";
      }
      // clientMode is set once at sign-in (see verifyCredentials). Do not re-query Supabase
      // on every JWT refresh — that was causing login and page loads to hang or time out.
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.role =
        ((token.role as string) === "AGENCY_ADMIN" ? "SUPER_ADMIN" : token.role) as UserRole;
      session.clientId = (token.clientId as string | null) ?? null;
      session.clientMode = (token.clientMode as ClientMode | undefined) ?? "team";
      session.alsoSells = Boolean(token.alsoSells);
      session.realUserId = (token.realUserId as string | null | undefined) ?? null;
      session.realUserName = (token.realUserName as string | null | undefined) ?? null;
      session.isImpersonating = Boolean(token.realUserId);
      if (session.user) {
        session.user.id = token.userId as string;
        if (token.email) {
          session.user.email = token.email;
        }
        if (token.name) {
          session.user.name = token.name;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
