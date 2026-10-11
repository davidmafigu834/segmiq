import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { allocateQuoteNumber, ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { saveItemsAndTotals } from "@/lib/quotations/persist";
import { logQuotationEvent } from "@/lib/quotations/events";
import { draftFingerprint } from "./catalogue";
import { followUpCalendarDate } from "./dates";
import { resolveClientSalesTimezone } from "@/lib/sales/intelligence/daily-plan-service";
import type { WorkItemRow } from "./store";
import { appendAudit } from "./store";

type QuoteLine = {
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number | null;
};

function linesFromPayload(payload: Record<string, unknown>): QuoteLine[] {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .map((item) => {
      const row = item as Record<string, unknown>;
      const name = String(row.name ?? "").trim();
      const quantity = Number(row.quantity);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        productId: typeof row.productId === "string" ? row.productId : null,
        name,
        quantity,
        unitPrice: row.unitPrice == null ? null : Number(row.unitPrice),
      };
    })
    .filter((line): line is QuoteLine => Boolean(line));
}

export async function applyFollowUp(input: {
  leadId: string;
  clientId: string;
  actorId: string;
  actorName: string;
  followUpAt: string;
  source: "HUMAN_CREATED" | "CUSTOMER_COMMITMENT";
  itemId: string;
  payloadHash: string;
}) {
  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("follow_up_date")
    .eq("id", input.leadId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  if (!lead) throw new Error("Lead not found");
  const timezone = await resolveClientSalesTimezone(input.clientId);
  const followUpDate = followUpCalendarDate(input.followUpAt, timezone);
  const dateUnchanged = (lead.follow_up_date as string | null) === followUpDate;
  if (!dateUnchanged) {
    const { error } = await supabase
      .from("leads")
      .update({
        follow_up_date: followUpDate,
        follow_up_source: input.source,
        follow_up_execution_mode: "HUMAN_ONLY",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId)
      .eq("client_id", input.clientId);
    if (error) throw new Error(error.message);
    await logLeadEvent({
      leadId: input.leadId,
      clientId: input.clientId,
      actor: { id: input.actorId, name: input.actorName, role: "SALESPERSON" },
      eventType: "FOLLOW_UP_SET",
      eventData: {
        follow_up_date: input.followUpAt,
        follow_up_day: followUpDate,
        source: "sales_copilot",
        work_item_id: input.itemId,
      },
      dedupeKey: `copilot:followup:${input.itemId}:${input.payloadHash}`,
    });
  }
  if (input.followUpAt.includes("T") && input.actorId) {
    await rememberCallbackTime(supabase, {
      leadId: input.leadId,
      actorId: input.actorId,
      itemId: input.itemId,
      callbackAt: input.followUpAt,
      followUpDate,
    });
  }
  return { followUpAt: input.followUpAt, unchanged: dateUnchanged };
}

async function rememberCallbackTime(
  supabase: SupabaseClient,
  input: { leadId: string; actorId: string; itemId: string; callbackAt: string; followUpDate: string }
) {
  const notes = `Sales Copilot reminder:${input.itemId}`;
  const { data: existing } = await supabase
    .from("call_logs")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("notes", notes)
    .limit(1)
    .maybeSingle();
  const row = {
    callback_at: input.callbackAt,
    follow_up_date: input.followUpDate,
    outcome: "FOLLOW_UP",
    reach_outcome: "call_back",
    result: "follow_up",
    notes,
  };
  const write = existing?.id
    ? supabase.from("call_logs").update(row).eq("id", existing.id)
    : supabase.from("call_logs").insert({ ...row, lead_id: input.leadId, user_id: input.actorId });
  const { error } = await write;
  if (error) throw new Error(error.message);
}

async function findReusableDraft(
  supabase: SupabaseClient,
  leadId: string,
  fingerprint: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("quotations")
    .select("id, status, copilot_fingerprint")
    .eq("lead_id", leadId)
    .eq("status", "draft")
    .eq("copilot_fingerprint", fingerprint)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.id as string | undefined) ?? null;
}

export async function prepareQuotationDraft(input: {
  clientId: string;
  leadId: string;
  dealId: string | null;
  actorId: string | null;
  actorName: string;
  lines: QuoteLine[];
  fingerprint: string;
}): Promise<{ quotationId: string; reused: boolean }> {
  if (!input.dealId) throw new Error("A deal is required before a quotation can be saved.");
  if (input.lines.length === 0) throw new Error("The quotation has no line items.");
  if (input.lines.some((line) => line.unitPrice == null || Number.isNaN(line.unitPrice))) {
    throw new Error("A catalogue price is missing, so the draft was not created.");
  }
  const supabase = createAdminClient();
  const existing = await findReusableDraft(supabase, input.leadId, input.fingerprint);
  if (existing) return { quotationId: existing, reused: true };

  const { data: deal } = await supabase
    .from("deals")
    .select("id, client_id, originating_lead_id")
    .eq("id", input.dealId)
    .maybeSingle();
  if (!deal || deal.client_id !== input.clientId || deal.originating_lead_id !== input.leadId) {
    throw new Error("Deal not found for this customer.");
  }
  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email")
    .eq("id", input.leadId)
    .eq("client_id", input.clientId)
    .maybeSingle();
  const settings = await ensureQuotationSettings(supabase, input.clientId);
  const taxRate = Number(settings.default_tax_rate) || 0;
  const validDays = settings.default_validity_days != null ? Number(settings.default_validity_days) : 14;
  const quoteNumber = await allocateQuoteNumber(supabase, input.clientId);
  const insert = {
    client_id: input.clientId,
    lead_id: input.leadId,
    deal_id: input.dealId,
    quote_number: quoteNumber,
    status: "draft",
    customer_name: (lead?.name as string | null) ?? null,
    customer_phone: (lead?.phone as string | null) ?? null,
    customer_email: (lead?.email as string | null) ?? null,
    tax_rate: taxRate,
    other_amount: 0,
    currency: (settings.default_currency as string) || "USD",
    valid_until: format(addDays(new Date(), validDays > 0 ? validDays : 14), "yyyy-MM-dd"),
    notes: null,
    terms: (settings.default_terms as string | null) ?? null,
    prepared_by_id: input.actorId || null,
    prepared_by_name: input.actorName,
    revision_number: 1,
    creation_source: "SALES_COPILOT",
    copilot_fingerprint: input.fingerprint,
  };
  let createdId: string | null = null;
  const first = await supabase.from("quotations").insert(insert).select("id").single();
  if (first.error || !first.data) {
    const legacy: Record<string, unknown> = { ...insert };
    delete legacy.creation_source;
    delete legacy.copilot_fingerprint;
    const second = await supabase.from("quotations").insert(legacy).select("id").single();
    if (second.error || !second.data) {
      throw new Error(first.error?.message ?? second.error?.message ?? "Quotation draft was not saved.");
    }
    createdId = second.data.id as string;
  } else {
    createdId = first.data.id as string;
  }
  await saveItemsAndTotals(
    supabase,
    createdId,
    input.lines.map((line) => ({
      item_name: line.name,
      quantity: line.quantity,
      unit_price: Number(line.unitPrice),
      product_id: line.productId,
      catalog_unit_price: Number(line.unitPrice),
    })),
    taxRate,
    0
  );
  await logQuotationEvent(supabase, {
    quotationId: createdId,
    clientId: input.clientId,
    leadId: input.leadId,
    dealId: input.dealId,
    actor: { id: input.actorId, name: input.actorName },
    eventType: "CREATED",
    eventData: { source: "sales_copilot", fingerprint: input.fingerprint },
  });
  return { quotationId: createdId, reused: false };
}

export function quotationReadyCopy(): { title: string; explanation: string } {
  return {
    title: "Quotation draft ready",
    explanation:
      "I’ve prepared a draft quotation using the products and quantities discussed. Please review the items and prices before sending.",
  };
}

export async function executeWorkItem(input: {
  item: WorkItemRow;
  actorId: string;
  actorName: string;
  followUpAt?: string | null;
}) {
  const payload = input.item.proposed_payload;
  const kind = String(payload.kind ?? input.item.action_type);
  try {
    if (kind === "follow_up" || input.item.linked_follow_up) {
      const followUpAt = input.followUpAt || input.item.proposed_at || String(payload.followUpAt ?? "");
      if (!followUpAt) throw new Error("Choose a date before scheduling this follow-up.");
      const source = payload.source === "CUSTOMER_COMMITMENT" ? "CUSTOMER_COMMITMENT" : "HUMAN_CREATED";
      await applyFollowUp({
        leadId: input.item.lead_id,
        clientId: input.item.client_id,
        actorId: input.actorId,
        actorName: input.actorName,
        followUpAt,
        source,
        itemId: input.item.id,
        payloadHash: input.item.payload_hash,
      });
      await appendAudit(input.item.id, { at: new Date().toISOString(), actorId: input.actorId, action: "executed" }, {
        execution_status: "succeeded",
        review_status: "approved",
        fulfilment_status: "open",
        queue: "todo",
        proposed_at: followUpAt,
        execution_error: null,
      });
      return { ok: true as const, followUpAt };
    }

    if (kind === "quotation_draft") {
      const lines = linesFromPayload(payload);
      const fingerprint =
        typeof payload.fingerprint === "string"
          ? payload.fingerprint
          : draftFingerprint(lines.map((line) => ({ productId: line.productId, name: line.name, quantity: line.quantity })));
      const prepared = await prepareQuotationDraft({
        clientId: input.item.client_id,
        leadId: input.item.lead_id,
        dealId: input.item.deal_id,
        actorId: input.actorId,
        actorName: input.actorName,
        lines,
        fingerprint,
      });
      const copy = quotationReadyCopy();
      await appendAudit(input.item.id, { at: new Date().toISOString(), actorId: input.actorId, action: "draft_saved" }, {
        execution_status: "succeeded",
        review_status: "pending",
        fulfilment_status: "open",
        queue: "needs_review",
        action_type: "quotation_draft",
        title: copy.title,
        explanation: copy.explanation,
        linked_quotation_id: prepared.quotationId,
        execution_error: null,
      });
      return { ok: true as const, quotationId: prepared.quotationId, reused: prepared.reused };
    }

    if (kind === "appointment" || input.item.action_type === "appointment") {
      const followUpAt = input.followUpAt || input.item.proposed_at;
      if (!followUpAt) throw new Error("Choose a viewing time. No appointment was created.");
      await applyFollowUp({
        leadId: input.item.lead_id,
        clientId: input.item.client_id,
        actorId: input.actorId,
        actorName: input.actorName,
        followUpAt,
        source: "HUMAN_CREATED",
        itemId: input.item.id,
        payloadHash: input.item.payload_hash,
      });
      await appendAudit(input.item.id, { at: new Date().toISOString(), actorId: input.actorId, action: "executed" }, {
        execution_status: "succeeded",
        review_status: "approved",
        fulfilment_status: "open",
        queue: "todo",
        linked_follow_up: true,
        proposed_at: followUpAt,
        execution_error: null,
        title: "Viewing follow-up",
        explanation: "The viewing time is saved as a follow-up. No separate appointment was booked.",
      });
      return { ok: true as const, followUpAt };
    }

    if (input.item.action_type === "send_quotation" || input.item.action_type === "answer_question" || input.item.action_type === "open_commitment") {
      await appendAudit(input.item.id, { at: new Date().toISOString(), actorId: input.actorId, action: "reviewed" }, {
        execution_status: "succeeded",
        review_status: "approved",
        fulfilment_status: "open",
        execution_error: null,
      });
      return { ok: true as const };
    }

    throw new Error("This suggestion cannot be executed automatically.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    await appendAudit(input.item.id, { at: new Date().toISOString(), actorId: input.actorId, action: "failed", error: message }, {
      execution_status: "failed",
      review_status: "approved",
      execution_error: message,
    });
    return { ok: false as const, error: message };
  }
}
