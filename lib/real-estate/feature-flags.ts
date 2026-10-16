/**
 * Server-side switch for the Phase 4 agency operations (commissions, handover, deal participants).
 * On unless RE_AGENCY_OPERATIONS is "off", "false" or "0". Read at request time, so changing the
 * Vercel environment variable takes effect on the next deployment without code changes.
 */
export function reAgencyOperationsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.RE_AGENCY_OPERATIONS?.trim().toLowerCase();
  return !(value === "off" || value === "false" || value === "0");
}

export const RE_AGENCY_OPERATIONS_DISABLED_MESSAGE =
  "Agency operations are switched off for this deployment. Ask an administrator to set RE_AGENCY_OPERATIONS.";
