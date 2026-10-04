import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  completionReadiness,
  equipmentNeedsSerial,
  installationAttention,
  schedulingWarnings,
  warrantyStatus,
} from "../lib/work-projects/installation-rules";

const sql = readFileSync("supabase/migrations/20261004040000_work_project_installation.sql", "utf8");

test("serials are required for inverters and batteries, not panels", () => {
  assert.equal(equipmentNeedsSerial("8kVA Inverter", null), true);
  assert.equal(equipmentNeedsSerial("5.12kWh Battery", null), true);
  assert.equal(equipmentNeedsSerial("550W solar panel", null), false);
  assert.equal(equipmentNeedsSerial("550W solar panel", true), true);
});

test("warranty status is calculated from dates", () => {
  const now = new Date("2026-10-04T00:00:00Z");
  assert.equal(warrantyStatus({ starts_at: "2026-11-01", expires_at: null }, now), "NOT_STARTED");
  assert.equal(warrantyStatus({ starts_at: "2026-10-01", expires_at: null, voided_at: "2026-10-02" }, now), "VOIDED");
  assert.equal(warrantyStatus({ starts_at: "2026-01-01", expires_at: "2026-09-01" }, now), "EXPIRED");
  assert.equal(warrantyStatus({ starts_at: "2026-01-01", expires_at: "2026-10-20" }, now), "EXPIRING_SOON");
  assert.equal(warrantyStatus({ starts_at: "2026-01-01", expires_at: "2028-01-01" }, now), "ACTIVE");
});

test("scheduling warns without blocking the decision", () => {
  const warnings = schedulingWarnings({
    paymentReady: false,
    assessmentRequired: true,
    assessmentReady: false,
    equipmentGaps: [{ description: "Battery", missing: 1 }],
  });
  assert.equal(warnings.length, 3);
  assert.match(warnings[2], /Battery/);
});

test("installation attention stays deterministic", () => {
  const lines = installationAttention({
    status: "QA_PENDING",
    equipmentIssuedShort: false,
    qaOutcome: null,
    projectStatus: "IN_PROGRESS",
    missingSerials: ["8kVA Inverter"],
    outstanding: 2320,
    handoverStatus: null,
  });
  assert.ok(lines.some((line) => line.includes("quality check")));
  assert.ok(lines.some((line) => line.includes("Serial number")));
});

test("solar completion blocks missing commissioning and allows a balance warning", () => {
  const blocked = completionReadiness({
    workflow: "SOLAR_INSTALLATION",
    projectStatus: "IN_PROGRESS",
    installationStatus: "HANDOVER_PENDING",
    qaOutcome: "PASS",
    commissioningStatus: "COMPLETED",
    handoverStatus: null,
    installedQuantity: 1,
    assetCount: 1,
    outstanding: 2320,
  });
  assert.equal(blocked.canComplete, false);
  assert.ok(blocked.blockers.some((line) => line.includes("Handover")));
  assert.equal(blocked.warnings.length, 1);

  const ready = completionReadiness({
    workflow: "SOLAR_INSTALLATION",
    projectStatus: "IN_PROGRESS",
    installationStatus: "COMPLETED",
    qaOutcome: "PASS",
    commissioningStatus: "COMPLETED",
    handoverStatus: "COMPLETED",
    installedQuantity: 4,
    assetCount: 4,
    outstanding: 2320,
  });
  assert.equal(ready.canComplete, true);
  assert.match(ready.warnings[0], /outstanding/);
});

test("general trades can complete without installed assets", () => {
  const ready = completionReadiness({
    workflow: "GENERAL_TRADES",
    projectStatus: "IN_PROGRESS",
    installationStatus: null,
    qaOutcome: null,
    commissioningStatus: null,
    handoverStatus: null,
    installedQuantity: 0,
    assetCount: 0,
    outstanding: null,
  });
  assert.equal(ready.canComplete, true);
});

test("failed commissioning is not operationally complete", () => {
  const lines = installationAttention({
    status: "COMMISSIONING_PENDING",
    equipmentIssuedShort: false,
    qaOutcome: "PASS",
    commissioningStatus: "FAILED",
    handoverStatus: null,
    projectStatus: "IN_PROGRESS",
    missingSerials: [],
    outstanding: null,
  });
  assert.ok(lines.some((line) => line.includes("Commissioning failed")));
  const gate = completionReadiness({
    workflow: "SOLAR_INSTALLATION",
    projectStatus: "IN_PROGRESS",
    installationStatus: "COMMISSIONING_PENDING",
    qaOutcome: "PASS",
    commissioningStatus: "FAILED",
    handoverStatus: null,
    installedQuantity: 0,
    assetCount: 0,
    outstanding: null,
  });
  assert.equal(gate.canComplete, false);
});

test("issue and return are tenant scoped, atomic, and idempotent", () => {
  assert.match(sql, /issue_work_project_equipment/);
  assert.match(sql, /STOCK_ISSUED/);
  assert.match(sql, /on_hand = on_hand - v_take/);
  assert.match(sql, /reserved = reserved - v_take/);
  assert.match(sql, /quantity_issued = quantity_issued \+ p_quantity/);
  assert.match(sql, /quantity_reserved = quantity_reserved - p_quantity/);
  assert.match(sql, /idempotency_key/);
  assert.match(sql, /return_work_project_equipment/);
  assert.match(sql, /'RETURN'/);
  assert.match(sql, /quantity_issued = quantity_issued - p_quantity/);
  assert.match(sql, /on_hand = on_hand \+ p_quantity/);
  assert.match(sql, /client_id = p_client_id/);
  assert.match(sql, /work_project_equipment_units_serial_uidx/);
  assert.match(sql, /customer_installed_assets_unit_uidx/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /WORK_PROJECT_INSTALLATION/);
  assert.doesNotMatch(sql, /subscription_id/);
});

test("commissioning creates assets only after a passed quality check", () => {
  assert.match(sql, /Commissioning needs a passed quality check/);
  assert.match(sql, /COMMISSIONING_FAILED/);
  assert.match(sql, /assets_created', 0/);
  assert.match(sql, /INSTALLED_ASSET_CREATED/);
  assert.match(sql, /status = 'INSTALLED'/);
  assert.match(sql, /installed_asset_id uuid/);
});
