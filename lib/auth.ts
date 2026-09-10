import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/password";
import { validateAuthClaims } from "@/lib/auth/session-validation";
import { fetchAuthUserByEmail, fetchClientMode } from "@/lib/supabase/auth-rest";
import { createUserSession, clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";
import { recordSecurityEvent, hashLoginIdentifier } from "@/lib/auth/security-events";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { JWT_MAX_AGE_SEC } from "@/lib/auth/session-policy";
import { userNeedsMfaChallenge, mustEnrollMfa } from "@/lib/auth/mfa/service";
import { labelSessionDevice } from "@/lib/auth/session-labels";
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
  sessionId?: string;
  /** Restricted session — MFA enrolment still required before CRM APIs. */
  mfaEnrolmentRequired?: boolean;
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
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email);
        const password = String(credentials.password);
        const ip = clientIpFromRequest(req as unknown as Request);
        const ua = userAgentFromRequest(req as unknown as Request);
        const emailHash = await hashLoginIdentifier(email);

        const rl = await checkDbRateLimit({
          key: `login:${emailHash}:${ip ?? "unknown"}`,
          limit: 10,
          windowMs: 15 * 60_000,
        });
        if (!rl.ok) {
          void recordSecurityEvent({
            eventType: "LOGIN_FAILED",
            ip,
            userAgent: ua,
            metadata: {
              emailHash,
              reason: "rate_limited",
              retryAfterSec: rl.retryAfterSec,
            },
          });
          return null;
        }

        let user: VerifiedUser | null;
        try {
          user = await verifyCredentials(email, password);
        } catch (e) {
          if (e instanceof AuthDatabaseUnavailableError) throw e;
          user = null;
        }

        if (!user) {
          void recordSecurityEvent({
            eventType: "LOGIN_FAILED",
            ip,
            userAgent: ua,
            metadata: {
              emailHash,
              reason: "invalid_credentials_or_inactive",
            },
          });
          return null;
        }

        // MFA-enabled accounts must complete /api/auth/mfa/login — never issue a full session here.
        const mfaNeed = await userNeedsMfaChallenge(user.id, user.role);
        if (mfaNeed.required) {
          void recordSecurityEvent({
            eventType: "LOGIN_FAILED",
            userId: user.id,
            clientId: user.clientId,
            ip,
            userAgent: ua,
            metadata: { reason: "mfa_required", channel: "web_credentials" },
          });
          return null;
        }

        // Policy requires MFA but user not enrolled → restricted enrolment session only.
        const enrolmentRequired = await mustEnrollMfa(user.id, user.role, {
          clientId: user.clientId,
        });

        // SECURITY: new session id after successful authentication (session fixation).
        const sessionRow = await createUserSession({
          userId: user.id,
          clientId: user.clientId,
          role: user.role,
          sessionType: "WEB",
          sessionVersion: user.sessionVersion,
          ip,
          userAgent: ua,
          authStrength: "password",
          metadata: enrolmentRequired
            ? { mfaEnrolmentRequired: true, restricted: true }
            : {},
        });

        void recordSecurityEvent({
          eventType: "LOGIN_SUCCESS",
          userId: user.id,
          clientId: user.clientId,
          sessionId: sessionRow.id,
          ip,
          userAgent: ua,
          metadata: {
            sessionType: "WEB",
            mfaEnrolmentRequired: enrolmentRequired,
          },
        });
        void recordSecurityEvent({
          eventType: "SESSION_CREATED",
          userId: user.id,
          clientId: user.clientId,
          sessionId: sessionRow.id,
          ip,
          userAgent: ua,
          metadata: {
            sessionType: "WEB",
            mfaEnrolmentRequired: enrolmentRequired,
          },
        });

        const label = labelSessionDevice({ sessionType: "WEB", userAgent: ua });
        void import("@/lib/email/templates/security-alert").then(({ sendSecurityNotification, shouldSendNewSignInEmail }) => {
          if (!enrolmentRequired && shouldSendNewSignInEmail(user.id, label.deviceName)) {
            void sendSecurityNotification({
              to: user.email,
              kind: "new_sign_in",
              deviceLabel: label.deviceName,
            });
          }
        });

        return {
          ...user,
          sessionId: sessionRow.id,
          mfaEnrolmentRequired: enrolmentRequired,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: JWT_MAX_AGE_SEC },
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
        token.sessionId = (user as { sessionId?: string }).sessionId ?? null;
        token.mfaEnrolmentRequired = Boolean(
          (user as { mfaEnrolmentRequired?: boolean }).mfaEnrolmentRequired
        );
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
      const valid = await validateAuthClaims(
        {
          userId: String(token.userId ?? ""),
          role: ((token.role as string) === "AGENCY_ADMIN" ? "SUPER_ADMIN" : token.role) as UserRole,
          clientId: (token.clientId as string | null | undefined) ?? null,
          alsoSells: Boolean(token.alsoSells),
          sessionVersion:
            typeof token.sessionVersion === "number"
              ? token.sessionVersion
              : Number.isInteger(token.sessionVersion)
                ? Number(token.sessionVersion)
                : undefined,
          realUserId: (token.realUserId as string | null | undefined) ?? null,
          sessionId: (token.sessionId as string | null | undefined) ?? null,
        },
        { touchActivity: false }
      );
      if (!valid.ok) {
        console.warn("[auth] Session rejected:", valid.reason);
        session.userId = "";
        session.role = "SALESPERSON";
        session.clientId = null;
        session.clientMode = "team";
        session.alsoSells = false;
        session.sessionId = null;
        session.realUserId = null;
        session.realUserName = null;
        session.isImpersonating = false;
        if (session.user) {
          session.user.id = "";
          session.user.email = null;
          session.user.name = null;
        }
        return session;
      }
      session.userId = token.userId as string;
      session.role =
        ((token.role as string) === "AGENCY_ADMIN" ? "SUPER_ADMIN" : token.role) as UserRole;
      session.clientId = (token.clientId as string | null) ?? null;
      session.clientMode = (token.clientMode as ClientMode | undefined) ?? "team";
      session.alsoSells = Boolean(token.alsoSells);
      session.sessionVersion = valid.claims.sessionVersion;
      session.sessionId = valid.claims.sessionId ?? null;
      session.mfaEnrolmentRequired = Boolean(token.mfaEnrolmentRequired);
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
