import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/password";
import type { ClientMode, UserRole } from "@/types";

export async function resolveClientMode(clientId: string | null): Promise<ClientMode> {
  if (!clientId) return "team";
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("mode").eq("id", clientId).maybeSingle();
  return (data as { mode?: string } | null)?.mode === "solo" ? "solo" : "team";
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
  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, password, role, client_id, is_active, session_version, also_sells")
    .eq("email", normalizedEmail)
    .maybeSingle();
  const dev = process.env.NODE_ENV === "development";
  const supabaseHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "(missing NEXT_PUBLIC_SUPABASE_URL)";
    } catch {
      return "(invalid NEXT_PUBLIC_SUPABASE_URL)";
    }
  })();
  if (error) {
    if (dev) console.error("[auth] Supabase users lookup failed:", error.message, error);
    return null;
  }
  if (!user) {
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
  if (!user.is_active) {
    if (dev) console.warn("[auth] User inactive:", normalizedEmail);
    return null;
  }
  const hash = String(user.password ?? "").trim();
  const ok = await verifyPassword(password, hash);
  if (!ok && dev) console.error("[auth] Password did not match stored hash for:", normalizedEmail);
  if (!ok) return null;
  const clientId = (user.client_id as string | null) ?? null;
  const clientMode = await resolveClientMode(clientId);
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    role: user.role as UserRole,
    clientId,
    clientMode,
    alsoSells: Boolean((user as { also_sells?: boolean }).also_sells),
    sessionVersion: Number((user as { session_version?: number }).session_version ?? 0),
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
      // Heal legacy AGENCY_ADMIN cookies after SUPER_ADMIN rename.
      if ((token.role as string) === "AGENCY_ADMIN") {
        token.role = "SUPER_ADMIN";
      }
      const clientId = (token.clientId as string | null) ?? null;
      token.clientMode = clientId ? await resolveClientMode(clientId) : "team";
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
