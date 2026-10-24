import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRequestLaunchMode,
  decideCommercialWrite,
} from "../lib/commercial-launch/gates";

describe("Release 5 commercial runtime gate", () => {
  it("fails closed when the environment kill switch is closed", () => {
    assert.deepEqual(
      decideCommercialWrite({
        mode: "GENERAL_AVAILABILITY",
        clientId: "client-1",
        pilotClientIds: [],
        environmentKillSwitchOpen: false,
      }),
      { allowed: false, reason: "environment_disabled" },
    );
  });

  it("blocks OFF and restricts INTERNAL_ONLY to synthetic activity", () => {
    assert.equal(
      decideCommercialWrite({
        mode: "OFF",
        clientId: "client-1",
        pilotClientIds: [],
        environmentKillSwitchOpen: true,
      }).allowed,
      false,
    );
    assert.equal(
      decideCommercialWrite({
        mode: "INTERNAL_ONLY",
        clientId: "client-1",
        pilotClientIds: [],
        environmentKillSwitchOpen: true,
      }).allowed,
      false,
    );
    assert.equal(
      decideCommercialWrite({
        mode: "INTERNAL_ONLY",
        clientId: null,
        pilotClientIds: [],
        environmentKillSwitchOpen: true,
        syntheticInternalRequest: true,
      }).allowed,
      true,
    );
  });

  it("allows only an explicitly allowlisted pilot customer", () => {
    const input = {
      mode: "PILOT_ALLOWLIST" as const,
      pilotClientIds: ["client-1"],
      environmentKillSwitchOpen: true,
    };
    assert.equal(
      decideCommercialWrite({ ...input, clientId: "client-1" }).allowed,
      true,
    );
    assert.equal(
      decideCommercialWrite({ ...input, clientId: "client-2" }).allowed,
      false,
    );
  });

  it("allows GA only while the environment kill switch remains open", () => {
    assert.equal(
      decideCommercialWrite({
        mode: "GENERAL_AVAILABILITY",
        clientId: "client-1",
        pilotClientIds: [],
        environmentKillSwitchOpen: true,
      }).allowed,
      true,
    );
  });
});

describe("Release 5 launch promotion prerequisites", () => {
  const requiredChecks = new Set([
    "r2_end_to_end",
    "r3_signing_end_to_end",
    "r4_shadow_reconciled",
    "legacy_classified",
    "invoice_idempotency",
    "tenant_isolation",
    "private_documents",
    "rollback_runbook",
    "support_owner",
  ]);

  it("permits safe rollback modes without readiness evidence", () => {
    assert.equal(
      canRequestLaunchMode({
        target: "OFF",
        passingChecks: new Set(),
        pilotClientIds: [],
      }).allowed,
      true,
    );
    assert.equal(
      canRequestLaunchMode({
        target: "INTERNAL_ONLY",
        passingChecks: new Set(),
        pilotClientIds: [],
      }).allowed,
      true,
    );
  });

  it("allows a named pilot without claiming GA evidence", () => {
    assert.deepEqual(
      canRequestLaunchMode({
        target: "PILOT_ALLOWLIST",
        passingChecks: new Set(),
        pilotClientIds: [],
      }),
      { allowed: false, missing: ["pilot_allowlist"] },
    );
    assert.deepEqual(
      canRequestLaunchMode({
        target: "PILOT_ALLOWLIST",
        passingChecks: new Set(),
        pilotClientIds: ["client-1"],
      }),
      { allowed: true, missing: [] },
    );
  });

  it("blocks GA when any required evidence is absent", () => {
    const incomplete = new Set(requiredChecks);
    incomplete.delete("tenant_isolation");
    assert.deepEqual(
      canRequestLaunchMode({
        target: "GENERAL_AVAILABILITY",
        passingChecks: incomplete,
        pilotClientIds: [],
      }),
      { allowed: false, missing: ["tenant_isolation"] },
    );
  });

  it("accepts promotion only with every required evidence check", () => {
    assert.equal(
      canRequestLaunchMode({
        target: "GENERAL_AVAILABILITY",
        passingChecks: requiredChecks,
        pilotClientIds: [],
      }).allowed,
      true,
    );
  });
});
