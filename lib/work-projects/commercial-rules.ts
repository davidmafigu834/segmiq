export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "CASH",
  "MOBILE_MONEY",
  "CARD",
  "CHEQUE",
  "FINANCE",
  "OTHER",
] as const;

export const PAYMENT_TRIGGERS = [
  "ON_ACCEPTANCE",
  "BEFORE_PROJECT_START",
  "BEFORE_PROCUREMENT",
  "EQUIPMENT_READY",
  "BEFORE_INSTALLATION",
  "ON_INSTALLATION",
  "ON_HANDOVER",
  "ON_COMPLETION",
  "CUSTOM_DATE",
  "OTHER",
] as const;

export type PaymentTrigger = (typeof PAYMENT_TRIGGERS)[number];

export type ProjectPaymentStatus =
  | "NOT_REQUIRED"
  | "AWAITING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

const GATE_TRIGGERS = new Set<PaymentTrigger>(["ON_ACCEPTANCE", "BEFORE_PROJECT_START"]);

export function moneyRound(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function termAmount(
  term: { termType: "PERCENTAGE" | "FIXED_AMOUNT"; percent: number | null; amount: number | null },
  projectValue: number | null
): number {
  if (term.termType === "FIXED_AMOUNT") return moneyRound(term.amount ?? 0);
  return moneyRound(((projectValue ?? 0) * (term.percent ?? 0)) / 100);
}

export function projectPaymentStatus(input: {
  projectValue: number | null;
  paymentRequired: boolean;
  confirmed: number;
  refunded: number;
  hasTerms: boolean;
}): ProjectPaymentStatus {
  const value = input.projectValue ?? 0;
  const received = moneyRound(input.confirmed);
  if (received > 0 && input.refunded > 0 && received < value) return "PARTIALLY_REFUNDED";
  if (received === 0 && input.refunded > 0) return "REFUNDED";
  if (!input.paymentRequired && received === 0) return "NOT_REQUIRED";
  if (value <= 0 && !input.hasTerms && received === 0) return "NOT_REQUIRED";
  if (value > 0 && received > value) return "OVERPAID";
  if (value > 0 && received === value) return "PAID";
  if (received > 0) return "PARTIALLY_PAID";
  return "AWAITING_PAYMENT";
}

export function outstandingBalance(projectValue: number | null, confirmed: number): number | null {
  if (projectValue == null) return null;
  return moneyRound(projectValue - confirmed);
}

export function paymentGate(input: {
  projectValue: number | null;
  terms: Array<{ trigger: string; termType: "PERCENTAGE" | "FIXED_AMOUNT"; percent: number | null; amount: number | null; id: string }>;
  confirmedByTerm: Map<string, number>;
  unallocatedConfirmed: number;
}): { configured: boolean; required: number; received: number; satisfied: boolean } {
  const gateTerms = input.terms.filter((term) => GATE_TRIGGERS.has(term.trigger as PaymentTrigger));
  if (!gateTerms.length) {
    return { configured: false, required: 0, received: 0, satisfied: true };
  }
  const required = moneyRound(gateTerms.reduce((sum, term) => sum + termAmount(term, input.projectValue), 0));
  const allocated = moneyRound(gateTerms.reduce((sum, term) => sum + (input.confirmedByTerm.get(term.id) ?? 0), 0));
  const received = Math.min(required, allocated + Math.max(0, input.unallocatedConfirmed));
  return { configured: true, required, received: moneyRound(received), satisfied: received + 0.001 >= required };
}

export function equipmentLineStatus(line: {
  cancelled: boolean;
  trackInventory: boolean;
  required: number;
  reserved: number;
  issued: number;
}): string {
  if (line.cancelled) return "CANCELLED";
  if (!line.trackInventory) return "NOT_STOCKED";
  if (line.issued >= line.required && line.required > 0) return "ISSUED";
  if (line.issued > 0) return "PARTIALLY_ISSUED";
  if (line.reserved >= line.required && line.required > 0) return "RESERVED";
  if (line.reserved > 0) return "PARTIALLY_RESERVED";
  return "REQUIRED";
}

export function quantityMissing(required: number, reserved: number, trackInventory: boolean): number {
  if (!trackInventory) return 0;
  return Math.max(0, moneyRound(required - reserved));
}

export function commercialAttention(input: {
  paymentStatus: ProjectPaymentStatus;
  gateSatisfied: boolean;
  gateConfigured: boolean;
  pendingPayments: number;
  overdueTerms: number;
  trackedLines: number;
  reservedUnits: number;
  missingUnits: number;
  releasedAndEmpty: boolean;
}): string[] {
  const lines: string[] = [];
  if (input.gateConfigured && !input.gateSatisfied) lines.push("Deposit not received");
  if (input.overdueTerms > 0) lines.push("Payment overdue");
  if (input.paymentStatus === "PARTIALLY_PAID" || input.paymentStatus === "PARTIALLY_REFUNDED") lines.push("Partially paid");
  if (input.trackedLines > 0 && input.reservedUnits === 0) lines.push("Equipment not reserved");
  if (input.missingUnits > 0) lines.push("Insufficient stock");
  if (input.releasedAndEmpty) lines.push("Reservation released");
  if (input.pendingPayments > 0) lines.push("Payment proof awaiting confirmation");
  return lines;
}

export function readinessSummary(input: {
  paymentStatus: ProjectPaymentStatus;
  gate: { configured: boolean; satisfied: boolean };
  assessmentCompleted: boolean;
  projectStatus: string;
  trackedRequired: number;
  trackedReserved: number;
  missing: Array<{ description: string; missing: number }>;
}): { commercial: string; technical: string; equipment: string; scheduling: string; nextStep: string } {
  const commercialReady =
    input.paymentStatus === "NOT_REQUIRED" ||
    input.paymentStatus === "PAID" ||
    input.paymentStatus === "OVERPAID" ||
    (input.gate.configured && input.gate.satisfied);
  const technicalReady =
    input.assessmentCompleted ||
    !["PLANNING", "SITE_ASSESSMENT"].includes(input.projectStatus);
  const equipmentReady = input.trackedRequired <= 0 || input.trackedReserved + 0.001 >= input.trackedRequired;
  const schedulingReady = commercialReady && technicalReady && equipmentReady;
  const firstMissing = input.missing.find((item) => item.missing > 0);
  let nextStep = "Ready for installation planning.";
  if (!commercialReady && input.gate.configured) nextStep = "Collect the deposit before scheduling installation.";
  else if (!technicalReady) nextStep = "Complete the site assessment before scheduling installation.";
  else if (firstMissing) nextStep = `Reserve remaining ${firstMissing.description} before scheduling installation.`;
  else if (!equipmentReady) nextStep = "Reserve required equipment before scheduling installation.";
  return {
    commercial: commercialReady ? "Deposit requirement met" : "Deposit requirement open",
    technical: technicalReady ? "Site assessment complete" : "Site assessment open",
    equipment: input.trackedRequired <= 0 ? "Not required" : equipmentReady ? "All required stock reserved" : "Stock still missing",
    scheduling: schedulingReady ? "Ready" : "Not ready",
    nextStep,
  };
}

export function quoteScheduleTerm(row: Record<string, unknown>): {
  label: string;
  termType: "PERCENTAGE" | "FIXED_AMOUNT";
  percent: number | null;
  amount: number | null;
  trigger: PaymentTrigger;
} | null {
  const label = String(row.label ?? row.name ?? "").trim();
  if (!label) return null;
  const percent = numberOrNull(row.percent ?? row.percentage);
  const amount = numberOrNull(row.amount);
  if (percent == null && amount == null) return null;
  return {
    label,
    termType: percent != null ? "PERCENTAGE" : "FIXED_AMOUNT",
    percent,
    amount: percent != null ? null : amount,
    trigger: mapTrigger(String(row.trigger ?? row.timing ?? row.condition ?? "")),
  };
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapTrigger(value: string): PaymentTrigger {
  const text = value.toLowerCase();
  if (text.includes("accept") || text.includes("deposit")) return "ON_ACCEPTANCE";
  if (text.includes("handover")) return "ON_HANDOVER";
  if (text.includes("complet")) return "ON_COMPLETION";
  if (text.includes("install")) return "BEFORE_INSTALLATION";
  if (text.includes("procure")) return "BEFORE_PROCUREMENT";
  if (text.includes("start")) return "BEFORE_PROJECT_START";
  if ((PAYMENT_TRIGGERS as readonly string[]).includes(value)) return value as PaymentTrigger;
  return "OTHER";
}

export function procurementGroups(
  rows: Array<{ description: string; missing: number; projectId: string; projectValue: number | null }>
): Array<{ description: string; missing: number; projects: number; blockedValue: number }> {
  const groups = new Map<string, { missing: number; projects: Set<string>; blockedValue: number }>();
  for (const row of rows) {
    if (row.missing <= 0) continue;
    const key = row.description.trim();
    const current = groups.get(key) ?? { missing: 0, projects: new Set<string>(), blockedValue: 0 };
    current.missing += row.missing;
    if (!current.projects.has(row.projectId)) {
      current.projects.add(row.projectId);
      current.blockedValue += row.projectValue ?? 0;
    }
    groups.set(key, current);
  }
  return [...groups.entries()].map(([description, group]) => ({
    description,
    missing: moneyRound(group.missing),
    projects: group.projects.size,
    blockedValue: moneyRound(group.blockedValue),
  }));
}
