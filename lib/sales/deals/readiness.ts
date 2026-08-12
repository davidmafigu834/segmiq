/**
 * Deal readiness — checklist before Create Deal.
 * Not an AI score. Value estimate may remain pending.
 */

import type { LeadRow } from "@/types";

export type DealReadinessItemId =
  | "requirement"
  | "project"
  | "interest"
  | "timeframe"
  | "next_step"
  | "value";

export type DealReadinessItem = {
  id: DealReadinessItemId;
  label: string;
  done: boolean;
  required: boolean;
};

export type DealReadinessResult = {
  ready: boolean;
  statusLabel: string;
  items: DealReadinessItem[];
  requiredDone: number;
  requiredTotal: number;
  missingRequired: DealReadinessItem[];
};

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function parseBudget(budget: string | null | undefined): boolean {
  if (!hasText(budget)) return false;
  const n = parseFloat(String(budget).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0;
}

export type DealReadinessInput = {
  lead: Pick<
    LeadRow,
    | "project_type"
    | "budget"
    | "timeline"
    | "customer_need"
    | "buying_timeframe"
    | "follow_up_date"
    | "form_data"
    | "status"
  >;
  /** Explicit discovery overrides from call / form before save */
  discovery?: {
    customerNeed?: string | null;
    projectType?: string | null;
    interestConfirmed?: boolean;
    buyingTimeframe?: string | null;
    nextStepAgreed?: boolean;
    nextActionAt?: string | null;
    valuePending?: boolean;
    estimatedValue?: number | null;
  };
};

/**
 * Ready when commercial opportunity confirmed + next step understood.
 * Exact value is NOT required.
 */
export function getDealReadiness(input: DealReadinessInput): DealReadinessResult {
  const { lead, discovery } = input;
  const need =
    discovery?.customerNeed ?? lead.customer_need ?? (lead.form_data?.need as string | undefined);
  const project = discovery?.projectType ?? lead.project_type;
  const timeframe = discovery?.buyingTimeframe ?? lead.buying_timeframe ?? lead.timeline;
  const nextAt = discovery?.nextActionAt ?? lead.follow_up_date;
  const interest =
    discovery?.interestConfirmed === true ||
    lead.status === "QUALIFIED" ||
    lead.status === "CONTACTED" ||
    lead.status === "CONVERTED_TO_DEAL";
  const nextStep =
    discovery?.nextStepAgreed === true || hasText(nextAt) || hasText(discovery?.customerNeed);
  const hasValue =
    (discovery?.estimatedValue != null && discovery.estimatedValue > 0) ||
    parseBudget(lead.budget) ||
    discovery?.valuePending === true;

  const items: DealReadinessItem[] = [
    {
      id: "requirement",
      label: "Customer requirement understood",
      done: hasText(need) || hasText(project),
      required: true,
    },
    {
      id: "project",
      label: "Service / project identified",
      done: hasText(project) || hasText(need),
      required: true,
    },
    {
      id: "interest",
      label: "Customer interest confirmed",
      done: interest,
      required: true,
    },
    {
      id: "next_step",
      label: "Next step agreed",
      done: nextStep,
      required: true,
    },
    {
      id: "timeframe",
      label: "Buying timeframe discussed",
      done: hasText(timeframe),
      required: false,
    },
    {
      id: "value",
      label: "Deal value estimated or marked pending",
      done: hasValue || discovery?.valuePending === true,
      required: false,
    },
  ];

  const required = items.filter((i) => i.required);
  const missingRequired = required.filter((i) => !i.done);
  const requiredDone = required.length - missingRequired.length;
  const ready = missingRequired.length === 0;

  let statusLabel: string;
  if (ready) {
    statusLabel = "Ready to create deal";
  } else if (missingRequired.length === 1) {
    statusLabel = "1 detail still needs attention";
  } else {
    statusLabel = `${missingRequired.length} details still need attention`;
  }

  return {
    ready,
    statusLabel,
    items,
    requiredDone,
    requiredTotal: required.length,
    missingRequired,
  };
}
