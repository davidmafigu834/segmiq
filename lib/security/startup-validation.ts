/**
 * Production startup validation (Phase 6).
 * Fail closed when critical crypto/auth secrets are missing in production.
 * Never log secret values.
 */

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function missing(name: string): boolean {
  return !process.env[name]?.trim();
}

function weakSecret(name: string, minLen = 32): boolean {
  const v = process.env[name]?.trim() ?? "";
  return v.length > 0 && v.length < minLen;
}

export type StartupValidationResult =
  | { ok: true; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateProductionSecrets(): StartupValidationResult {
  if (!isProductionRuntime()) {
    return { ok: true, warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of [
    "NEXTAUTH_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (missing(key)) errors.push(`Missing required env: ${key}`);
  }

  if (missing("WHATSAPP_SESSION_ENCRYPTION_KEY") && missing("ACCOUNT_SECURITY_ENCRYPTION_KEY")) {
    errors.push(
      "Missing encryption key: set WHATSAPP_SESSION_ENCRYPTION_KEY or ACCOUNT_SECURITY_ENCRYPTION_KEY"
    );
  }

  if (missing("CRON_SECRET")) {
    warnings.push("CRON_SECRET is unset — production cron routes will deny all requests");
  }

  if (weakSecret("NEXTAUTH_SECRET", 32)) {
    errors.push("NEXTAUTH_SECRET is too short (need at least 32 characters)");
  }

  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, warnings };
}

/** Call from instrumentation register(). */
export function assertProductionSecretsOrThrow(): void {
  const result = validateProductionSecrets();
  for (const w of result.warnings) {
    console.warn(`[startup] ${w}`);
  }
  if (!result.ok) {
    for (const e of result.errors) {
      console.error(`[startup] ${e}`);
    }
    throw new Error("SegmiQ production startup aborted: missing or weak critical configuration");
  }
}
