import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261024055835_commercial_history_privilege_hardening.sql",
  ),
  "utf8",
).toLowerCase();

test("commercial history hardening removes destructive service-role grants", () => {
  assert.match(migration, /revoke\s+truncate[\s\S]+from service_role/);
  assert.match(
    migration,
    /revoke\s+update,\s*delete[\s\S]+platform_commercial_audit_events[\s\S]+from service_role/,
  );
  assert.match(migration, /platform_commercial_release_evidence/);
  assert.match(migration, /platform_invoice_lines/);
});

test("commercial history hardening contains no data or schema destruction", () => {
  assert.doesNotMatch(migration, /\bdrop\s+(table|schema)\b/);
  assert.doesNotMatch(migration, /\btruncate\s+table\b/);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/);
  assert.doesNotMatch(migration, /\bupdate\s+[a-z_]/);
});
