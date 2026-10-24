import type { CommercialLaunchMode } from "./types";

export function decideCommercialWrite(input: {
  mode: CommercialLaunchMode;
  clientId: string | null;
  pilotClientIds: readonly string[];
  environmentKillSwitchOpen: boolean;
  syntheticInternalRequest?: boolean;
}): { allowed: boolean; reason: string } {
  if (!input.environmentKillSwitchOpen)
    return { allowed: false, reason: "environment_disabled" };
  if (input.mode === "OFF") return { allowed: false, reason: "release_off" };
  if (input.mode === "INTERNAL_ONLY")
    return input.syntheticInternalRequest
      ? { allowed: true, reason: "internal_only" }
      : { allowed: false, reason: "internal_only" };
  if (input.mode === "PILOT_ALLOWLIST")
    return input.clientId && input.pilotClientIds.includes(input.clientId)
      ? { allowed: true, reason: "pilot_allowlist" }
      : { allowed: false, reason: "not_in_pilot" };
  return { allowed: true, reason: "general_availability" };
}

export function canRequestLaunchMode(input: {
  target: CommercialLaunchMode;
  passingChecks: ReadonlySet<string>;
  pilotClientIds: readonly string[];
}): { allowed: boolean; missing: string[] } {
  if (input.target === "OFF" || input.target === "INTERNAL_ONLY")
    return { allowed: true, missing: [] };
  if (input.target === "PILOT_ALLOWLIST")
    return input.pilotClientIds.length > 0
      ? { allowed: true, missing: [] }
      : { allowed: false, missing: ["pilot_allowlist"] };
  const required = [
    "r2_end_to_end",
    "r3_signing_end_to_end",
    "r4_shadow_reconciled",
    "legacy_classified",
    "invoice_idempotency",
    "tenant_isolation",
    "private_documents",
    "rollback_runbook",
    "support_owner",
  ];
  const missing = required.filter((key) => !input.passingChecks.has(key));
  return { allowed: missing.length === 0, missing };
}
