import { z } from "zod";

export const launchModeInput = z.object({
  targetMode: z.enum([
    "OFF",
    "INTERNAL_ONLY",
    "PILOT_ALLOWLIST",
    "GENERAL_AVAILABILITY",
  ]),
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().trim().min(10).max(500),
  evidenceRefs: z.array(z.string().trim().min(3).max(300)).max(30).default([]),
  decisionOwner: z.string().trim().min(3).max(120),
  rollbackOwner: z.string().trim().min(3).max(120),
  pilotClientIds: z.array(z.string().uuid()).max(100).default([]),
  idempotencyKey: z.string().trim().min(12).max(200),
});
