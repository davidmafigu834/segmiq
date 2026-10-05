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

const NAME_STOP = new Set([
  "what", "when", "how", "which", "who", "is", "has", "have", "prepare", "draft", "create",
  "show", "summarise", "summarize", "update", "follow", "schedule", "remind", "today",
  "project", "installation", "customer",
]);

/** Prefer a project code or a named customer. Skip the first capitalised verb. */
export function guessCustomerToken(text: string): string | null {
  const code = text.match(/\b(PRJ-\d+)\b/i);
  if (code) return code[1].toUpperCase();
  const two = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)['’]s\b/);
  if (two && !NAME_STOP.has(two[1].split(" ")[0].toLowerCase())) return two[1];
  const possessive = text.match(/\b([A-Z][a-z]+)['’]s\b/);
  if (possessive && !NAME_STOP.has(possessive[1].toLowerCase())) return possessive[1];
  const named = text.match(/\b(?:for|about|update|summarise|summarize|remind)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (named && !NAME_STOP.has(named[1].toLowerCase())) return named[1];
  const words = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  return words.find((word) => !NAME_STOP.has(word.toLowerCase())) ?? null;
}

export type StaffIntent =
  | "deny_payment_confirm"
  | "operations_attention"
  | "sales_focus"
  | "create_task"
  | "schedule_follow_up"
  | "schedule_installation"
  | "add_note"
  | "draft_message"
  | "installation_brief"
  | "customer_update"
  | "payment"
  | "balance"
  | "installation_date"
  | "readiness"
  | "quality"
  | "support_brief"
  | "policy"
  | "summary";

export function routeStaffIntent(text: string, opts: { hasProject: boolean; role: string }): StaffIntent {
  if (/\b(confirm|mark).*(payment|paid)\b/i.test(text) || /\bpayment as confirmed\b/i.test(text)) return "deny_payment_confirm";
  if (/\b(add|leave|record)\b/i.test(text) && /\bnote\b/i.test(text)) return "add_note";
  if (/\b(task|remind)\b/i.test(text)) return "create_task";
  if (/\bdraft\b/i.test(text) || /\bcustomer update\b/i.test(text)) return "customer_update";
  if (/\bfollow up\b/i.test(text) || /\bfollow-up\b/i.test(text)) return "schedule_follow_up";
  if (/\bschedule\b/i.test(text) && /\binstallation\b/i.test(text)) return "schedule_installation";
  if (/\bbrief\b/i.test(text)) return "installation_brief";
  if (/\b(qa|quality check|rework)\b/i.test(text)) return "quality";
  if (/\bsupport\b/i.test(text) && opts.hasProject) return "support_brief";
  if (/\b(company policy|normally|sop|company brain)\b/i.test(text)) return "policy";
  if (/\b(paid|payment|deposit)\b/i.test(text) && !/\b(owe|outstanding|balance)\b/i.test(text)) return "payment";
  if (/\b(owe|outstanding|balance)\b/i.test(text)) return "balance";
  if (/\b(when|installation date|installing)\b/i.test(text)) return "installation_date";
  if (!opts.hasProject && /\b(which|what|who|show)\b/i.test(text) && /\b(project|projects|job|jobs|installation|payment|stock|qa|handover|support|attention|focus|proof)\b/i.test(text)) {
    if (opts.role === "SALESPERSON" && /\b(follow|customer|quote|lead)\b/i.test(text)) return "sales_focus";
    return "operations_attention";
  }
  if ((opts.hasProject || guessCustomerToken(text)) && /\b(ready|blocked|missing|equipment)\b/i.test(text)) return "readiness";
  if (!opts.hasProject && /\b(follow up|my customers|going cold|quotations)\b/i.test(text) && opts.role === "SALESPERSON") return "sales_focus";
  if (!opts.hasProject && /\b(attention|focus|today|stock|handover|unresolved)\b/i.test(text)) {
    return opts.role === "SALESPERSON" ? "sales_focus" : "operations_attention";
  }
  if (/\b(draft|whatsapp|message)\b/i.test(text)) return "draft_message";
  return "summary";
}

export function paymentConfirmAnswer(role: string): string {
  if (role === "SALESPERSON") return "You don't have permission to confirm customer payments.";
  return "Confirming a customer payment stays on the payment record. I have not marked any money as received.";
}

export function qualityAnswer(outcome: string | null): string {
  if (!outcome) return "No quality check is recorded.";
  if (outcome === "REQUIRES_REWORK" || outcome === "FAIL") {
    return `The latest quality check is ${outcome}. I cannot mark it as passed.`;
  }
  return `Latest quality check: ${outcome}.`;
}

export function warrantyExpiryAnswer(expiresAt: string | null): string {
  if (!expiresAt) return "The warranty expiry date isn't recorded.";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "The warranty expiry date isn't recorded.";
  const active = date.getTime() >= Date.now();
  return active
    ? `The warranty is active until ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
    : `The recorded warranty ended on ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`;
}

export function projectInsight(facts: ProjectFacts): string | null {
  if (facts.depositSatisfied && facts.assessmentCompleted && facts.equipmentGaps.length) {
    const gap = facts.equipmentGaps[0];
    const item = gap && gap.missing === 1 ? `one ${gap.description}` : facts.equipmentGaps.map((row) => `${row.missing} ${row.description}`).join(", ");
    return `Deposit is confirmed and the site assessment is complete, but ${item} is still missing. Resolve the stock shortage before scheduling installation.`;
  }
  if (facts.qaOutcome === "REQUIRES_REWORK" || facts.qaOutcome === "FAIL") {
    return "The latest quality check requires rework before this installation can move on.";
  }
  if (!facts.installationScheduledAt && facts.depositSatisfied && facts.assessmentCompleted && facts.equipmentGaps.length === 0) {
    return "Payment, assessment, and equipment are ready. No installation date has been confirmed yet.";
  }
  return null;
}

export function documentContentAnswer(snippet: string): string {
  if (looksLikePromptInjection(snippet)) {
    return "That document includes text asking me to ignore my rules. I am treating it as document content, and I will not follow it.";
  }
  const clean = snippet.replace(/\s+/g, " ").trim().slice(0, 500);
  return clean || "I don't have readable text from a document you can see.";
}

const AMOUNT = /(?:[$£€]\s?\d[\d,]*(?:\.\d+)?)|(?:\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)/g;

export function narrationKeepsGrounding(source: string, narrated: string): boolean {
  const next = narrated.trim();
  if (!next || next.length > 2500) return false;
  if (looksLikePromptInjection(next)) return false;
  if (/no installation date has been confirmed/i.test(source) && /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)\b/i.test(next) && !/\bno installation date\b/i.test(next)) {
    return false;
  }
  const allowed = new Set(source.match(AMOUNT) ?? []);
  const used = next.match(AMOUNT) ?? [];
  return used.every((amount) => allowed.has(amount));
}

export function stripTenantArgs(args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args };
  delete next.client_id;
  delete next.clientId;
  delete next.service_role;
  delete next.serviceRole;
  return next;
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
