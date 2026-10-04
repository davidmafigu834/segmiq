export type EquipmentGap = { description: string; missing: number };

export type ProjectFacts = {
  projectId: string;
  number: string | null;
  title: string;
  contactName: string;
  site: string | null;
  projectValue: number | null;
  currency: string;
  confirmedPaid: number;
  pendingAmount: number;
  outstanding: number | null;
  depositSatisfied: boolean;
  assessmentCompleted: boolean;
  assessmentSummary: string | null;
  equipmentGaps: EquipmentGap[];
  installationScheduledAt: string | null;
  installationStatus: string | null;
  qaOutcome: string | null;
  commissioningCompleted: boolean;
  commissioningAt: string | null;
  handoverCompleted: boolean;
  handoverAt: string | null;
};

export type AttentionItem = {
  kind: string;
  title: string;
  detail: string;
  projectId?: string;
};

const INJECTION =
  /ignore (all |any |previous |your |the )?(system )?instructions|reveal internal|show (me )?every project|dump (the |all )?database|you are now|system prompt/i;

export function looksLikePromptInjection(text: string): boolean {
  return INJECTION.test(text);
}

export function moneyLabel(amount: number, currency = "USD"): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.001;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: whole ? 0 : 2,
      minimumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${whole ? Math.round(amount) : amount.toFixed(2)}`;
  }
}

export function equipmentReady(facts: Pick<ProjectFacts, "equipmentGaps">): boolean {
  return facts.equipmentGaps.length === 0;
}

export function installationReadinessAnswer(facts: ProjectFacts): { ready: boolean; answer: string } {
  const equipmentOk = equipmentReady(facts);
  const ready = facts.depositSatisfied && facts.assessmentCompleted && equipmentOk;
  if (ready && !facts.installationScheduledAt) {
    return {
      ready: true,
      answer: "Payment, site assessment, and equipment are ready. No installation date has been confirmed yet.",
    };
  }
  if (ready) {
    return { ready: true, answer: "Payment, site assessment, and equipment are ready, and an installation date is already on the record." };
  }
  const gaps = facts.equipmentGaps.map((gap) => {
    const noun = gap.missing === 1 ? gap.description : `${gap.missing} × ${gap.description}`;
    return gap.missing === 1 ? `one ${gap.description}` : noun;
  });
  const parts: string[] = [];
  if (facts.depositSatisfied) parts.push("Payment is ready");
  else parts.push("The deposit requirement is not satisfied");
  if (facts.assessmentCompleted) parts.push("the site assessment is complete");
  else parts.push("the site assessment is not complete");
  if (!equipmentOk) {
    parts.push(`equipment is incomplete because ${gaps.join(" and ")} ${gaps.length === 1 && facts.equipmentGaps[0]?.missing === 1 ? "is" : "are"} missing`);
  }
  const lead = ready ? "Yes." : "No.";
  if (facts.depositSatisfied && facts.assessmentCompleted && facts.equipmentGaps.length === 1 && facts.equipmentGaps[0]?.missing === 1) {
    return {
      ready: false,
      answer: `No. Payment and assessment are ready, but equipment is incomplete because one ${facts.equipmentGaps[0].description} is missing.`,
    };
  }
  return { ready, answer: `${lead} ${parts.join(", ")}.` };
}

export function paymentAnswer(facts: ProjectFacts): string {
  const paid = moneyLabel(facts.confirmedPaid, facts.currency);
  if (facts.pendingAmount > 0) {
    return `${paid} confirmed. ${moneyLabel(facts.pendingAmount, facts.currency)} is still waiting for confirmation and is not counted as received.`;
  }
  return `${paid} confirmed.`;
}

export function balanceAnswer(facts: ProjectFacts): string {
  if (facts.outstanding == null) return "I don't have a project value on record, so I can't state an outstanding balance.";
  return `${moneyLabel(facts.outstanding, facts.currency)} outstanding. Confirmed received is ${moneyLabel(facts.confirmedPaid, facts.currency)}.`;
}

export function installationDateAnswer(scheduledAt: string | null): string {
  if (!scheduledAt) return "No installation date has been confirmed.";
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return "No installation date has been confirmed.";
  return `Installation is scheduled for ${date.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.`;
}

export function projectSummary(facts: ProjectFacts): string {
  const readiness = installationReadinessAnswer(facts);
  return [
    `${facts.contactName} — ${facts.number || facts.title}`,
    facts.site ? `Site: ${facts.site}` : null,
    paymentAnswer(facts),
    readiness.answer,
    installationDateAnswer(facts.installationScheduledAt),
    facts.qaOutcome ? `Latest quality check: ${facts.qaOutcome}.` : null,
    facts.commissioningCompleted ? "Commissioning is recorded as complete." : "Commissioning has not yet been recorded as complete.",
  ].filter(Boolean).join("\n");
}

export function installationBrief(facts: ProjectFacts): string {
  const lines = [
    "Installation brief",
    `Customer: ${facts.contactName}`,
    `Project: ${facts.title}${facts.number ? ` (${facts.number})` : ""}`,
    `Site: ${facts.site || "Not recorded"}`,
    `Payment: ${paymentAnswer(facts)}`,
    `Site assessment: ${facts.assessmentCompleted ? "Completed" : "Not completed"}`,
    facts.assessmentSummary ? `Site findings: ${facts.assessmentSummary}` : "Site findings: none recorded on the completed assessment.",
    facts.equipmentGaps.length
      ? `Outstanding equipment: ${facts.equipmentGaps.map((gap) => `${gap.missing} ${gap.description}`).join(", ")}`
      : "Outstanding equipment: none recorded.",
    installationDateAnswer(facts.installationScheduledAt),
  ];
  return lines.join("\n");
}

export function customerUpdateDraft(facts: ProjectFacts): string {
  const first = facts.contactName.split(/\s+/)[0] || "there";
  const bits = [`Hi ${first}.`];
  if (facts.assessmentCompleted && facts.depositSatisfied) bits.push("Your site assessment and deposit are complete.");
  else if (facts.depositSatisfied) bits.push("Your deposit is recorded.");
  else if (facts.assessmentCompleted) bits.push("Your site assessment is complete.");
  if (facts.equipmentGaps.length) {
    bits.push("We are still arranging equipment, so your installation date has not yet been confirmed.");
  } else if (!facts.installationScheduledAt) {
    bits.push("Your installation date has not yet been confirmed.");
  } else {
    bits.push(installationDateAnswer(facts.installationScheduledAt));
  }
  if (facts.commissioningCompleted) bits.push("Testing and commissioning are recorded as complete.");
  bits.push("We'll update you when the next date is confirmed.");
  return bits.join(" ");
}

export function portalPaymentAnswer(paid: number, pendingExcluded: number, currency: string): string {
  const label = moneyLabel(paid, currency);
  if (pendingExcluded > 0) return `${label} confirmed. A payment proof is still waiting for the company to confirm and is not included.`;
  return `${label} confirmed.`;
}

export function refuseInjection(): string {
  return "I can only answer from your own project, payments, installed equipment, warranties, and documents shared with you.";
}

export function assertNoPrivateFacts(value: unknown): string[] {
  const banned = ["internal_notes", "internalNotes", "cost", "cost_price", "margin", "lead_score", "supplier", "on_hand", "reserved"];
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (banned.includes(key)) found.push(key);
      walk(child);
    }
  };
  walk(value);
  return found;
}
