/**
 * createDealFromLead — authorize, validate, transactional RPC, activity.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DealRow,
  DealStage,
  DealValueBasis,
  DealValueStatus,
  DecisionMakerStatus,
  LeadRow,
} from "@/types";
import { getDealReadiness } from "./readiness";
import { inferValueStatus } from "./commercial-value";
import { isDealActiveStage } from "./display";

export type CreateDealFromLeadInput = {
  leadId: string;
  actorId: string;
  name: string;
  serviceSummary?: string | null;
  stage?: Extract<DealStage, "QUALIFIED" | "SCOPING" | "PROPOSAL_SENT" | "NEGOTIATING">;
  customerNeed?: string | null;
  location?: string | null;
  buyingTimeframe?: string | null;
  decisionMakerStatus?: DecisionMakerStatus | null;
  decisionMakerName?: string | null;
  expectedDecisionAt?: string | null;
  customerBudget?: number | null;
  salesEstimate?: number | null;
  estimatedValue?: number | null;
  estimatedValueMin?: number | null;
  estimatedValueMax?: number | null;
  valuePending?: boolean;
  nextActionAt?: string | null;
  nextActionLabel?: string | null;
  /** Skip readiness gate (server migration / admin). Default false. */
  force?: boolean;
};

export type CreateDealFromLeadResult =
  | { ok: true; deal: DealRow; alreadyExisted: boolean }
  | { ok: false; error: string; code: string; status: number };

function resolveValueFields(input: CreateDealFromLeadInput): {
  value_status: DealValueStatus;
  value_basis: DealValueBasis | null;
  estimated_value: number | null;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  customer_budget: number | null;
  sales_estimate: number | null;
} {
  const customerBudget =
    input.customerBudget != null && input.customerBudget > 0 ? input.customerBudget : null;
  const salesEstimate =
    input.salesEstimate != null && input.salesEstimate > 0
      ? input.salesEstimate
      : input.estimatedValue != null && input.estimatedValue > 0
        ? input.estimatedValue
        : null;
  const min =
    input.estimatedValueMin != null && input.estimatedValueMin > 0
      ? input.estimatedValueMin
      : null;
  const max =
    input.estimatedValueMax != null && input.estimatedValueMax > 0
      ? input.estimatedValueMax
      : null;

  const value_status = inferValueStatus({
    estimatedValue: salesEstimate ?? customerBudget,
    min,
    max,
    pending: input.valuePending === true || (salesEstimate == null && customerBudget == null && min == null),
  });

  let value_basis: DealValueBasis | null = null;
  if (value_status === "RANGE") {
    value_basis = customerBudget != null ? "CUSTOMER_BUDGET" : "SALES_ESTIMATE";
  } else if (salesEstimate != null) {
    value_basis = "SALES_ESTIMATE";
  } else if (customerBudget != null) {
    value_basis = "CUSTOMER_BUDGET";
  }

  return {
    value_status,
    value_basis,
    estimated_value: salesEstimate ?? customerBudget,
    estimated_value_min: min,
    estimated_value_max: max,
    customer_budget: customerBudget,
    sales_estimate: salesEstimate,
  };
}

export async function createDealFromLead(
  input: CreateDealFromLeadInput
): Promise<CreateDealFromLeadResult> {
  const supabase = createAdminClient();
  const name = input.name?.trim();
  if (!name) {
    return { ok: false, error: "Deal name is required.", code: "NAME_REQUIRED", status: 400 };
  }

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", input.leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return { ok: false, error: "Lead not found.", code: "LEAD_NOT_FOUND", status: 404 };
  }

  const leadRow = lead as LeadRow;

  if (leadRow.status === "NOT_QUALIFIED") {
    return {
      ok: false,
      error: "This lead is not qualified — no deal can be created.",
      code: "LEAD_NOT_QUALIFIED",
      status: 409,
    };
  }

  // Idempotent: return existing active deal
  const { data: existing } = await supabase
    .from("deals")
    .select("*")
    .eq("originating_lead_id", input.leadId)
    .not("stage", "in", '("WON","LOST")')
    .maybeSingle();

  if (existing) {
    return { ok: true, deal: existing as DealRow, alreadyExisted: true };
  }

  if (!input.force) {
    const readiness = getDealReadiness({
      lead: leadRow,
      discovery: {
        customerNeed: input.customerNeed,
        projectType: input.serviceSummary ?? leadRow.project_type,
        interestConfirmed: true,
        buyingTimeframe: input.buyingTimeframe,
        nextStepAgreed: Boolean(input.nextActionAt || input.nextActionLabel),
        nextActionAt: input.nextActionAt,
        valuePending: input.valuePending,
        estimatedValue: input.estimatedValue ?? input.salesEstimate ?? input.customerBudget,
      },
    });
    if (!readiness.ready) {
      return {
        ok: false,
        error: readiness.statusLabel,
        code: "NOT_READY",
        status: 400,
      };
    }
  }

  const values = resolveValueFields(input);
  const stage = input.stage && isDealActiveStage(input.stage) ? input.stage : "QUALIFIED";

  const { data: rpcId, error: rpcErr } = await supabase.rpc("create_deal_from_lead", {
    p_lead_id: input.leadId,
    p_actor_id: input.actorId,
    p_name: name,
    p_service_summary: input.serviceSummary ?? leadRow.project_type ?? null,
    p_stage: stage,
    p_value_status: values.value_status,
    p_value_basis: values.value_basis,
    p_estimated_value: values.estimated_value,
    p_estimated_value_min: values.estimated_value_min,
    p_estimated_value_max: values.estimated_value_max,
    p_customer_budget: values.customer_budget,
    p_sales_estimate: values.sales_estimate,
    p_expected_decision_at: input.expectedDecisionAt ?? null,
    p_location: input.location ?? null,
    p_buying_timeframe: input.buyingTimeframe ?? leadRow.buying_timeframe ?? leadRow.timeline,
    p_decision_maker_status: input.decisionMakerStatus ?? leadRow.decision_maker_status ?? null,
    p_decision_maker_name: input.decisionMakerName ?? null,
    p_next_action_at: input.nextActionAt ?? null,
    p_next_action_label: input.nextActionLabel ?? null,
    p_customer_need: input.customerNeed ?? leadRow.customer_need ?? null,
  });

  if (rpcErr) {
    const msg = rpcErr.message || "";
    if (msg.includes("LEAD_NOT_QUALIFIED")) {
      return {
        ok: false,
        error: "This lead is not qualified — no deal can be created.",
        code: "LEAD_NOT_QUALIFIED",
        status: 409,
      };
    }
    if (msg.includes("LEAD_NOT_FOUND")) {
      return { ok: false, error: "Lead not found.", code: "LEAD_NOT_FOUND", status: 404 };
    }
    console.error("[createDealFromLead] rpc error", rpcErr);
    return {
      ok: false,
      error: "We couldn't create this Deal. Your Lead information has not been changed.",
      code: "CREATE_FAILED",
      status: 500,
    };
  }

  const dealId = rpcId as string;
  const { data: deal } = await supabase.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (!deal) {
    return {
      ok: false,
      error: "We couldn't create this Deal. Your Lead information has not been changed.",
      code: "CREATE_FAILED",
      status: 500,
    };
  }

  return { ok: true, deal: deal as DealRow, alreadyExisted: false };
}
