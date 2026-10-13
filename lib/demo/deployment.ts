/**
 * Guest access is off unless it is explicitly selected.
 *
 * Shared database (current production app): set SEGMQ_DEMO_DATABASE=shared,
 * SEGMQ_DEMO_GUEST_ACCESS=enabled, and SEGMQ_DEMO_SCHEMA to the applied guest
 * migration version. The first two flags alone do not enable guest access.
 * Do not set SEGMQ_DEPLOYMENT=demo. That flag is the isolated-deployment kill
 * switch and would stop customer integrations.
 * Unset SEGMQ_DEMO_GUEST_ACCESS to stop guest access without ending customer sessions.
 *
 * Isolated deployment (later, optional): SEGMQ_DEPLOYMENT=demo, plus the two
 * Supabase project refs, plus the guest switch. The URL must be the demo host.
 */

export type DeploymentEnv = {
  SEGMQ_DEPLOYMENT?: string | null;
  SEGMQ_DEMO_DATABASE?: string | null;
  SEGMQ_DEMO_GUEST_ACCESS?: string | null;
  SEGMQ_DEMO_SCHEMA?: string | null;
  SEGMQ_DEMO_SUPABASE_REF?: string | null;
  SEGMQ_PRODUCTION_SUPABASE_REF?: string | null;
  NEXT_PUBLIC_SUPABASE_URL?: string | null;
};

/** Set only after `20261012194500_demo_guest_sessions.sql` is confirmed on the target database. */
export const DEMO_GUEST_SCHEMA_VERSION = "20261012194500";

export type GuestAccessBlockReason =
  | "guest-access-disabled"
  | "guest-schema-not-ready"
  | "shared-database-not-selected"
  | "supabase-project-unpinned"
  | "supabase-project-mismatch"
  | "production-database-refused";

type EnvInput = DeploymentEnv | NodeJS.ProcessEnv;

function envValue(env: EnvInput, key: keyof DeploymentEnv): string | undefined {
  const value = (env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value : undefined;
}

/** Isolated demo deployment. Must not be set on the production application. */
export function isDemoDeployment(env: EnvInput = process.env): boolean {
  return envValue(env, "SEGMQ_DEPLOYMENT") === "demo";
}

/** Same application and database as paying customers. Guest access stays request-scoped. */
export function isSharedDemoDatabase(env: EnvInput = process.env): boolean {
  return envValue(env, "SEGMQ_DEMO_DATABASE") === "shared";
}

/** True when the Supabase URL host is exactly `<ref>.supabase.co`. */
export function supabaseUrlUsesRef(url: string | null | undefined, ref: string | null | undefined): boolean {
  const projectRef = ref?.trim();
  if (!url || !projectRef) return false;
  try {
    return new URL(url).hostname === `${projectRef}.supabase.co`;
  } catch {
    return false;
  }
}

export function guestAccessBlockReason(env: EnvInput = process.env): GuestAccessBlockReason | null {
  if (envValue(env, "SEGMQ_DEMO_GUEST_ACCESS") !== "enabled") return "guest-access-disabled";
  if (envValue(env, "SEGMQ_DEMO_SCHEMA") !== DEMO_GUEST_SCHEMA_VERSION) return "guest-schema-not-ready";
  if (isDemoDeployment(env)) {
    const demoRef = envValue(env, "SEGMQ_DEMO_SUPABASE_REF")?.trim() ?? "";
    const productionRef = envValue(env, "SEGMQ_PRODUCTION_SUPABASE_REF")?.trim() ?? "";
    if (!demoRef || !productionRef || demoRef === productionRef) return "supabase-project-unpinned";
    if (supabaseUrlUsesRef(envValue(env, "NEXT_PUBLIC_SUPABASE_URL"), productionRef)) return "production-database-refused";
    if (!supabaseUrlUsesRef(envValue(env, "NEXT_PUBLIC_SUPABASE_URL"), demoRef)) return "supabase-project-mismatch";
    return null;
  }
  if (!isSharedDemoDatabase(env)) return "shared-database-not-selected";
  return null;
}

/**
 * A process marked as the demo deployment must not open the named production
 * project. Production processes are unchanged when the deployment flag is unset.
 */
export function assertDemoDatabaseAllowed(env: EnvInput = process.env): void {
  if (!isDemoDeployment(env)) return;
  const productionRef = envValue(env, "SEGMQ_PRODUCTION_SUPABASE_REF")?.trim();
  if (productionRef && supabaseUrlUsesRef(envValue(env, "NEXT_PUBLIC_SUPABASE_URL"), productionRef)) {
    throw new Error("Demo deployment refused the production Supabase project.");
  }
}

export function isGuestAccessEnabled(env: EnvInput = process.env): boolean {
  return guestAccessBlockReason(env) === null;
}

/** Invitation links last at most 30 days. Sessions last 12 hours. */
export const DEMO_INVITATION_MAX_MS = 30 * 24 * 60 * 60 * 1000;
export const DEMO_INVITATION_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;
export const DEMO_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const DEMO_SESSION_COOKIE = "segmiq_demo_session";

export function demoSessionCookieOptions(maxAgeSec: number): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}
