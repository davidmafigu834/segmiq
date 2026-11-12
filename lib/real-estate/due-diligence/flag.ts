/**
 * Due diligence stays off until a deployment sets RE_DUE_DILIGENCE to on, true, or 1.
 * The migration is source-only until that deployment applies it to its own database.
 */
export function dueDiligenceEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.RE_DUE_DILIGENCE?.trim().toLowerCase();
  return value === "on" || value === "true" || value === "1";
}

export const DUE_DILIGENCE_DISABLED_MESSAGE = "Not found";
