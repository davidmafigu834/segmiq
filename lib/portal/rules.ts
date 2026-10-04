import { warrantyStatus, type WarrantyLifecycle } from "@/lib/work-projects/installation-rules";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const PORTAL_STAGE_LABEL = {
  CONFIRMED: "Project confirmed",
  SITE_ASSESSMENT: "Site assessment",
  PREPARING: "Preparing your project",
  INSTALLATION_SCHEDULED: "Installation scheduled",
  INSTALLATION_IN_PROGRESS: "Installation in progress",
  TESTING: "Testing & commissioning",
  HANDOVER: "Final handover",
  COMPLETED: "Completed",
  ON_HOLD: "Project temporarily on hold",
  CANCELLED: "Project cancelled",
} as const;

export type PortalStage = keyof typeof PORTAL_STAGE_LABEL;

export function otpDecision(input: {
  now: Date;
  expiresAt: Date;
  consumedAt: string | null;
  attempts: number;
  codeMatches: boolean;
}): { ok: true } | { ok: false; reason: "expired" | "used" | "locked" | "mismatch" } {
  if (input.consumedAt) return { ok: false, reason: "used" };
  if (input.expiresAt.getTime() <= input.now.getTime()) return { ok: false, reason: "expired" };
  if (input.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (!input.codeMatches) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

export function otpSendAllowed(recentSends: number): boolean {
  return recentSends < OTP_MAX_SENDS_PER_HOUR;
}

export function resolvePortalStage(input: {
  projectStatus: string;
  installationStatus: string | null;
  commissioningStatus: string | null;
  handoverStatus: string | null;
}): PortalStage {
  if (input.projectStatus === "CANCELLED") return "CANCELLED";
  if (input.projectStatus === "ON_HOLD") return "ON_HOLD";
  if (input.projectStatus === "COMPLETED") return "COMPLETED";
  if (input.handoverStatus === "COMPLETED" || input.installationStatus === "COMPLETED") return "HANDOVER";
  if (input.commissioningStatus === "COMPLETED" || input.installationStatus === "HANDOVER_PENDING") return "HANDOVER";
  if (
    input.installationStatus === "QA_PENDING" ||
    input.installationStatus === "COMMISSIONING_PENDING" ||
    input.projectStatus === "QUALITY_CHECK" ||
    input.projectStatus === "HANDOVER"
  ) {
    return "TESTING";
  }
  if (input.installationStatus === "IN_PROGRESS" || input.installationStatus === "PAUSED") return "INSTALLATION_IN_PROGRESS";
  if (input.installationStatus === "SCHEDULED") return "INSTALLATION_SCHEDULED";
  if (input.projectStatus === "SITE_ASSESSMENT") return "SITE_ASSESSMENT";
  if (input.projectStatus === "PLANNING") return "CONFIRMED";
  return "PREPARING";
}

export function portalNextStep(stage: PortalStage, scheduleLabel: string | null): string {
  if (stage === "INSTALLATION_SCHEDULED" && scheduleLabel) return `Installation scheduled ${scheduleLabel}`;
  if (stage === "INSTALLATION_SCHEDULED") return "Your installation date is being confirmed.";
  if (stage === "INSTALLATION_IN_PROGRESS") return "Your installation is underway.";
  if (stage === "TESTING") return "Your installation is being tested and commissioned.";
  if (stage === "HANDOVER") return "Handover is being prepared.";
  if (stage === "COMPLETED") return "Your project is complete. Your system, warranty, and support stay here.";
  if (stage === "ON_HOLD") return "We'll update you when work resumes.";
  if (stage === "CANCELLED") return "This project is no longer going ahead.";
  if (stage === "SITE_ASSESSMENT") return "We're arranging the site assessment.";
  if (stage === "PREPARING") return "We're preparing the work.";
  return "Your project is confirmed.";
}

export type PortalTimelineItem = {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming";
};

export function portalTimeline(input: {
  confirmed: boolean;
  assessmentCompleted: boolean;
  showDeposit: boolean;
  depositReceived: boolean;
  equipmentRequired: boolean;
  equipmentPrepared: boolean;
  installationScheduled: boolean;
  installationStarted: boolean;
  commissioningCompleted: boolean;
  handoverCompleted: boolean;
  projectCompleted: boolean;
}): PortalTimelineItem[] {
  const steps: Array<{ key: string; label: string; done: boolean; include: boolean }> = [
    { key: "confirmed", label: "Project confirmed", done: input.confirmed, include: true },
    { key: "assessment", label: "Site assessment", done: input.assessmentCompleted, include: true },
    { key: "deposit", label: "Deposit received", done: input.depositReceived, include: input.showDeposit },
    { key: "equipment", label: "Equipment prepared", done: input.equipmentPrepared, include: input.equipmentRequired },
    { key: "installation", label: "Installation", done: input.installationStarted, include: true },
    { key: "commissioning", label: "Testing & commissioning", done: input.commissioningCompleted, include: true },
    { key: "handover", label: "Handover", done: input.handoverCompleted, include: true },
  ];
  const visible = steps.filter((step) => step.include);
  const firstOpen = visible.findIndex((step) => !step.done);
  return visible.map((step, index) => ({
    key: step.key,
    label: step.label,
    state: step.done ? "done" : index === firstOpen ? "current" : "upcoming",
  }));
}

export function portalMoney(confirmedAmounts: number[], projectValue: number | null) {
  const paid = Math.round(confirmedAmounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
  const outstanding = projectValue == null ? null : Math.max(0, Math.round((projectValue - paid) * 100) / 100);
  return { paid, outstanding, projectValue };
}

export function allocateTermPayments(
  terms: Array<{ id: string; label: string; amount: number }>,
  confirmedTotal: number
) {
  let remaining = confirmedTotal;
  return terms.map((term) => {
    const paid = Math.min(term.amount, Math.max(0, remaining));
    remaining -= paid;
    return { id: term.id, label: term.label, amount: term.amount, state: paid + 0.009 >= term.amount ? "Paid" : "Pending" };
  });
}

export function customerWarrantyLabel(status: WarrantyLifecycle): string | null {
  if (status === "VOIDED" || status === "NOT_STARTED") return null;
  if (status === "EXPIRING_SOON") return "Expiring soon";
  if (status === "EXPIRED") return "Expired";
  return "Active";
}

export function warrantyForPortal(row: { voided_at?: string | null; starts_at: string; expires_at?: string | null }, now = new Date()) {
  const status = warrantyStatus(row, now);
  const label = customerWarrantyLabel(status);
  if (!label) return null;
  return { label, startsAt: row.starts_at, expiresAt: row.expires_at ?? null };
}

export function supportStatusLabel(status: string): string {
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "WAITING_ON_CUSTOMER") return "Waiting for you";
  if (status === "RESOLVED") return "Resolved";
  return "Received";
}

export const PORTAL_SUPPORT_CATEGORIES = [
  { id: "TECHNICAL", label: "Report a problem" },
  { id: "WARRANTY", label: "Warranty issue" },
  { id: "INSTALLATION", label: "Installation issue" },
  { id: "CUSTOMER_SERVICE", label: "General question" },
  { id: "MAINTENANCE", label: "Request maintenance" },
] as const;

export const PORTAL_UPGRADE_INTENTS = [
  "Add another battery",
  "Add more panels",
  "Increase inverter capacity",
  "Other",
] as const;

const PRIVATE_KEYS = [
  "internal_notes",
  "notes",
  "cost",
  "cost_price",
  "margin",
  "lead_score",
  "score",
  "supplier",
  "reserved",
  "on_hand",
];

export function assertPortalDto(value: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (PRIVATE_KEYS.includes(key)) found.push(path ? `${path}.${key}` : key);
      walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(value, "");
  return found;
}
