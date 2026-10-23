const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GRACE_DAYS = 7;
export const MAX_STANDARD_GRACE_DAYS = 30;

export function validateGracePeriod(input: { startsAt: Date; endsAt: Date; reason?: string }): void {
  const duration = input.endsAt.getTime() - input.startsAt.getTime();
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Grace end must be after its start");
  if (duration > MAX_STANDARD_GRACE_DAYS * DAY_MS) throw new Error(`Grace periods cannot exceed ${MAX_STANDARD_GRACE_DAYS} days`);
  if (input.reason !== undefined && input.reason.trim().length < 3) throw new Error("A specific grace-period reason is required");
}
export function isGraceActive(input: { now: Date; startsAt: Date; endsAt: Date; endedAt?: Date | null }): boolean {
  const now = input.now.getTime();
  return !input.endedAt && input.startsAt.getTime() <= now && now < input.endsAt.getTime();
}
export function resolveBillingAccess(input: { now: Date; subscriptionStatus: string; overdueEnforcementAt: Date | null; grace?: { startsAt: Date; endsAt: Date; endedAt?: Date | null } | null; securitySuspended?: boolean }): "allow" | "block" {
  if (input.securitySuspended || input.subscriptionStatus === "cancelled" || input.subscriptionStatus === "suspended") return "block";
  if (!input.overdueEnforcementAt || input.now < input.overdueEnforcementAt) return "allow";
  return input.grace && isGraceActive({ now: input.now, ...input.grace }) ? "allow" : "block";
}
