/**
 * Migrate legacy plaintext website_integration_api_key → hash + prefix, then clear plaintext.
 *
 * Run: npx tsx scripts/migrate-website-api-keys.ts
 * Loads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Idempotent: only rows with non-empty plaintext and null/empty hash are updated.
 * Never prints API keys.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createAdminClient } from "../lib/supabase/admin";
import { hashWebsiteApiKey, websiteApiKeyPrefix } from "../lib/auth/website-api-keys";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("clients")
    .select("id, website_integration_api_key, website_integration_api_key_hash")
    .not("website_integration_api_key", "is", null);

  if (error) {
    console.error("[migrate-website-api-keys] select failed:", error.message);
    process.exit(1);
  }

  let migrated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const id = row.id as string;
    const plaintext = typeof row.website_integration_api_key === "string"
      ? row.website_integration_api_key.trim()
      : "";
    const existingHash =
      typeof row.website_integration_api_key_hash === "string"
        ? row.website_integration_api_key_hash.trim()
        : "";

    if (!plaintext) {
      skipped += 1;
      continue;
    }
    if (existingHash) {
      // Hash already present — clear leftover plaintext only.
      const { error: clearErr } = await supabase
        .from("clients")
        .update({ website_integration_api_key: null })
        .eq("id", id)
        .not("website_integration_api_key", "is", null);
      if (clearErr) {
        console.error(`[migrate-website-api-keys] clear plaintext failed for client ${id}:`, clearErr.message);
        process.exit(1);
      }
      migrated += 1;
      continue;
    }

    const { error: updErr } = await supabase
      .from("clients")
      .update({
        website_integration_api_key_hash: hashWebsiteApiKey(plaintext),
        website_integration_api_key_prefix: websiteApiKeyPrefix(plaintext),
        website_integration_api_key: null,
      })
      .eq("id", id);

    if (updErr) {
      console.error(`[migrate-website-api-keys] update failed for client ${id}:`, updErr.message);
      process.exit(1);
    }
    migrated += 1;
  }

  console.log(
    `[migrate-website-api-keys] done. migrated=${migrated} skipped_empty=${skipped} scanned=${(rows ?? []).length}`
  );
}

main().catch((err) => {
  console.error("[migrate-website-api-keys] unexpected:", err instanceof Error ? err.message : err);
  process.exit(1);
});
