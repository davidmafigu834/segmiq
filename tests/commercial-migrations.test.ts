import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationNames = [
  "20261023114812_segmiq_commercial_foundation_release1.sql",
  "20261023160000_platform_commercial_atomic_workflows.sql",
  "20261023180000_platform_sales_quotes_and_agreement_foundation.sql",
  "20261023210000_platform_ai_usage_shadow_and_topup_foundation.sql",
  "20261023230000_commercial_launch_controls.sql",
  "20261023233000_commercial_release5_1_safety_workflows.sql",
  "20261023234500_commercial_release5_2_controlled_customer_migrations.sql",
] as const;

function migration(name: (typeof migrationNames)[number]): string {
  return readFileSync(join(root, "supabase", "migrations", name), "utf8");
}

describe("Commercial migration reconciliation", () => {
  it("keeps R1 through R5.2 in dependency order", () => {
    assert.deepEqual([...migrationNames].sort(), migrationNames);
    assert.match(migration(migrationNames[1]), /platform_commercial_accounts/);
    assert.match(
      migration(migrationNames[2]),
      /platform_deny_history_modifications/,
    );
    assert.match(migration(migrationNames[3]), /platform_price_catalog/);
    assert.match(
      migration(migrationNames[4]),
      /platform_commercial_audit_events/,
    );
    assert.match(migration(migrationNames[5]), /platform_ai_topup_requests/);
    assert.match(
      migration(migrationNames[6]),
      /platform_migrate_commercial_account/,
    );
  });

  it("does not contain destructive table or history rewrites", () => {
    for (const name of migrationNames.slice(1)) {
      const sql = migration(name);
      assert.doesNotMatch(sql, /\bdrop\s+table\b/i, name);
      assert.doesNotMatch(sql, /\btruncate\b/i, name);
      assert.doesNotMatch(sql, /\bdelete\s+from\b/i, name);
    }
  });

  it("keeps new public commercial tables service-role only", () => {
    for (const name of migrationNames.slice(2, 5)) {
      const sql = migration(name);
      assert.match(sql, /enable row level security/i, name);
      assert.match(sql, /revoke (all|execute).*authenticated/is, name);
      assert.match(sql, /grant (all|execute).*service_role/is, name);
    }
  });

  it("schedules renewal changes and provides a separately authorised apply step", () => {
    const sql = migration(migrationNames[1]);
    assert.match(sql, /p_charge_handling <> 'at_renewal'/);
    assert.match(
      sql,
      /case when v_apply_now then 'applied' else 'approved' end/,
    );
    assert.match(sql, /platform_apply_approved_plan_change/);
    assert.match(sql, /v_request\.effective_at > now\(\)/);
    assert.match(sql, /Stale commercial account snapshot/);
  });

  it("contains no undeclared R4 action reference in the conversation function", () => {
    const sql = migration(migrationNames[3]);
    const conversation = sql.slice(
      sql.indexOf("platform_record_ai_customer_conversation"),
      sql.indexOf("platform_record_ai_internal_action"),
    );
    assert.doesNotMatch(conversation, /v_action/);
  });

  it("requires exact paid invoice evidence before top-up activation", () => {
    const sql = migration(migrationNames[5]);
    assert.match(sql, /v_invoice\.status<>'paid'/);
    assert.match(sql, /v_payment\.status<>'confirmed'/);
    assert.match(sql, /round\(v_invoice\.amount\*100\)/);
    assert.match(sql, /round\(v_payment\.amount\*100\)/);
    assert.match(sql, /status='active'/);
  });

  it("prevents backdated or premature legacy migration activation", () => {
    const sql = migration(migrationNames[6]);
    assert.match(sql, /effective date cannot be backdated/i);
    assert.match(sql, /effective time arrives/i);
    assert.match(sql, /legacy_records_preserved/);
    assert.match(sql, /Signed agreement or amendment reference required/);
    assert.match(sql, /aiSku/);
  });
});
