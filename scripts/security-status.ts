/**
 * Safe security readiness status (no secret values).
 * Usage: npx tsx scripts/security-status.ts
 */
import { createHash } from "crypto";

async function main() {
  const lines: string[] = [];
  lines.push("=== SegmiQ security:status ===");
  lines.push(`NODE_ENV=${process.env.NODE_ENV || "(unset)"}`);
  lines.push(`CSP_ENFORCE=${process.env.CSP_ENFORCE === "true" ? "true" : "false (Report-Only)"}`);
  lines.push(
    `MFA_ENFORCE_SUPER_ADMIN=${process.env.MFA_ENFORCE_SUPER_ADMIN === "true" ? "true" : "false"}`
  );

  const required = [
    "NEXTAUTH_SECRET",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const k of required) {
    const v = process.env[k]?.trim();
    lines.push(`${k}: ${v ? `present (len=${v.length})` : "MISSING"}`);
  }
  const enc =
    process.env.ACCOUNT_SECURITY_ENCRYPTION_KEY?.trim() ||
    process.env.WHATSAPP_SESSION_ENCRYPTION_KEY?.trim();
  lines.push(`encryption_key: ${enc ? `present (len=${enc.length})` : "MISSING"}`);
  lines.push(`CRON_SECRET: ${process.env.CRON_SECRET?.trim() ? "present" : "missing (warn)"}`);

  try {
    const { createAdminClient } = await import("../lib/supabase/admin");
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .not("website_integration_api_key", "is", null);
    if (error) lines.push(`legacy_plaintext_website_keys: ERROR ${error.message}`);
    else lines.push(`legacy_plaintext_website_keys: ${count ?? 0}`);
  } catch (e) {
    lines.push(
      `legacy_plaintext_website_keys: SKIP (${e instanceof Error ? e.message : "no db"})`
    );
  }

  // Fingerprint config presence without revealing values
  const fp = createHash("sha256")
    .update(String(process.env.NEXTAUTH_SECRET || ""))
    .digest("hex")
    .slice(0, 8);
  lines.push(`nextauth_secret_fp8: ${process.env.NEXTAUTH_SECRET ? fp : "n/a"}`);
  lines.push("=== end ===");
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
