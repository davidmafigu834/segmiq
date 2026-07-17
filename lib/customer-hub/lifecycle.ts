export const CONTACT_LIFECYCLES = ["cold", "aware", "pipeline", "customer"] as const;

export type ContactLifecycle = (typeof CONTACT_LIFECYCLES)[number];

export const CONTACT_LIFECYCLE_LABELS: Record<ContactLifecycle, string> = {
  cold: "Cold",
  aware: "Aware",
  pipeline: "Pipeline",
  customer: "Customer",
};

export const CONTACT_LIFECYCLE_DESCRIPTIONS: Record<ContactLifecycle, string> = {
  cold: "Doesn't know your business yet — no outreach logged",
  aware: "Knows you but isn't in an active deal",
  pipeline: "Active deal in progress",
  customer: "Won business — your repeat and referral base",
};

export function isContactLifecycle(value: string | null | undefined): value is ContactLifecycle {
  return CONTACT_LIFECYCLES.includes(value as ContactLifecycle);
}

export function lifecycleBadgeClass(lifecycle: ContactLifecycle): string {
  if (lifecycle === "customer") return "bg-[rgba(212,255,79,0.12)] text-[var(--accent)]";
  if (lifecycle === "pipeline") return "bg-[rgba(245,166,35,0.12)] text-[var(--warning)]";
  if (lifecycle === "aware") return "bg-[rgba(100,149,237,0.12)] text-[var(--info)]";
  return "bg-white/[0.07] text-[var(--text-secondary)]";
}

export function normalizeLegacyLifecycle(
  lifecycle: string | null | undefined
): ContactLifecycle {
  if (lifecycle === "lead") return "cold";
  if (isContactLifecycle(lifecycle)) return lifecycle;
  return "cold";
}
