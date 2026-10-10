import { createAdminClient } from "@/lib/supabase/admin";
import { loadCompanyBrainSnapshot } from "@/lib/company-brain/store";
import { resolveClientSalesTimezone } from "@/lib/sales/intelligence/daily-plan-service";
import { analyseConversation } from "./analyse";
import { defaultRequiredFields, draftFingerprint } from "./catalogue";
import { prepareQuotationDraft, quotationReadyCopy } from "./execute";
import { enrichAnalysis } from "./ai";
import { reconcileProposals } from "./reconcile";
import { listWorkItems, loadAnalysis, persistReconcile, saveAnalysis } from "./store";
import type { CatalogueItem, CopilotMessage, ListingItem, RequiredField } from "./types";

function hourFromClock(value: string | null | undefined, fallback: number): number {
  const match = value?.match(/^(\d{2})/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 23 ? hour : fallback;
}

function stringFact(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export async function runCopilotAnalysis(
  clientId: string,
  leadId: string,
  opts?: { enrich?: boolean; persist?: boolean }
): Promise<{ contextRevision: string; proposals: import("./types").ProposalDraft[] } | null> {
  const supabase = createAdminClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, active_deal_id, status, follow_up_date, form_data, budget, timeline, name")
    .eq("id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (leadError || !lead) return;

  const [{ data: messageRows }, { data: client }, { data: hours }, { data: quote }, { data: products }, { data: listings }] =
    await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("id, direction, body, created_at, status, actor_id")
        .eq("lead_id", leadId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("clients")
        .select("business_type, copilot_contact_later_days, copilot_checkin_offset_days")
        .eq("id", clientId)
        .maybeSingle(),
      supabase
        .from("sales_execution_settings")
        .select("work_start_time")
        .eq("client_id", clientId)
        .is("salesperson_id", null)
        .maybeSingle(),
      supabase
        .from("quotations")
        .select("status")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id, name, sku, brand, selling_price, track_inventory")
        .eq("client_id", clientId)
        .eq("status", "ACTIVE")
        .limit(200),
      supabase
        .from("listings")
        .select("id, address, suburb, status, transaction_type")
        .eq("client_id", clientId)
        .limit(80),
    ]);

  const messages: CopilotMessage[] = ((messageRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      id: String(row.id),
      direction: row.direction === "inbound" ? "inbound" : "outbound",
      body: String(row.body ?? ""),
      createdAt: String(row.created_at),
      status: (row.status as string | null) ?? (row.direction === "inbound" ? "received" : "sent"),
      authorId: (row.actor_id as string | null) ?? null,
      authorName: null,
    }))
    .filter((message) => message.body.trim())
    .reverse();

  const catalogue: CatalogueItem[] = ((products ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    sku: (row.sku as string | null) ?? null,
    brand: (row.brand as string | null) ?? null,
    size: null,
    unitPrice: row.selling_price == null ? null : Number(row.selling_price),
    stockQty: null,
  }));
  const listingItems: ListingItem[] = ((listings ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.address ?? row.suburb ?? "Listing"),
    location: (row.suburb as string | null) ?? null,
    intent: (row.transaction_type as string | null) ?? null,
  }));

  let requiredFields: RequiredField[] = [];
  let appointments = false;
  try {
    const brain = await loadCompanyBrainSnapshot(clientId);
    const playbook = brain.playbooks.find((item) => item.enabled && item.fields.some((field) => field.required));
    requiredFields = (playbook?.fields ?? [])
      .filter((field) => field.required)
      .map((field) => ({ key: field.internalKey, label: field.label }));
    appointments = brain.appointmentTypes.length > 0;
  } catch {
    requiredFields = [];
  }
  const businessType = (client?.business_type as string | null) ?? null;
  if (requiredFields.length === 0) {
    requiredFields = defaultRequiredFields({
      businessType,
      hasListings: businessType === "real_estate" || listingItems.length > 0,
      hasProducts: catalogue.length > 0,
    });
  }

  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const knownFacts: Record<string, string> = {};
  for (const field of requiredFields) {
    const fromForm = stringFact(formData[field.key]) ?? stringFact(formData[field.label]);
    if (fromForm) knownFacts[field.key] = fromForm;
  }
  const budget = stringFact(lead.budget);
  const timeline = stringFact(lead.timeline);
  if (budget) knownFacts.budget = budget;
  if (timeline) knownFacts.preferred_date = timeline;

  const timezone = await resolveClientSalesTimezone(clientId);
  const contactLaterDays = Number(client?.copilot_contact_later_days) || 7;
  const checkinOffsetDays = Number(client?.copilot_checkin_offset_days) || 1;
  const deterministic = analyseConversation({
    timezone,
    defaultHour: hourFromClock(hours?.work_start_time as string | null, 9),
    contactLaterDays,
    checkinOffsetDays,
    capabilities: {
      quotations: catalogue.length > 0 || businessType !== "real_estate",
      listings: businessType === "real_estate" || listingItems.length > 0,
      appointments: appointments || businessType === "real_estate",
      reminders: true,
      stock: catalogue.some((item) => item.stockQty != null) || ((products ?? []) as Array<Record<string, unknown>>).some((row) => row.track_inventory === true),
    },
    requiredFields,
    knownFacts,
    catalogue,
    listings: listingItems,
    stage: (lead.status as string | null) ?? null,
    followUpAt: (lead.follow_up_date as string | null) ?? null,
    quoteStatus: (quote?.status as string | null) ?? null,
    doNotContact: false,
    messages,
  });

  const enriched =
    opts?.enrich === false
      ? { analysis: deterministic, model: null as string | null, error: null as string | null }
      : await enrichAnalysis(deterministic, messages);
  const analysis = enriched.analysis;
  if (messages.length >= 40) {
    const previous = await loadAnalysis(leadId);
    if (previous?.summary) {
      analysis.summary = `Earlier context: ${previous.summary.slice(0, 280)} ${analysis.summary}`.slice(0, 800);
    }
  }

  if (opts?.persist === false) {
    return { contextRevision: analysis.contextRevision, proposals: analysis.proposals };
  }

  const existing = await listWorkItems(leadId, clientId);
  const plan = reconcileProposals({
    proposals: analysis.proposals,
    fulfilledKeys: analysis.fulfilledKeys,
    contextRevision: analysis.contextRevision,
    loadedMessageIds: messages.map((message) => message.id),
    existing: existing.map((item) => ({
      id: item.id,
      semanticKey: item.semantic_key,
      payloadHash: item.payload_hash,
      reviewStatus: item.review_status,
      executionStatus: item.execution_status,
      fulfilmentStatus: item.fulfilment_status,
      contextRevision: item.context_revision,
      evidenceMessageIds: item.evidence_message_ids,
      salespersonChoice: item.proposed_payload.salespersonChoice === true,
      chosenId: typeof item.proposed_payload.chosenId === "string" ? item.proposed_payload.chosenId : null,
    })),
  });

  const ownerId = (lead.assigned_to_id as string | null) ?? null;
  const dealId = (lead.active_deal_id as string | null) ?? null;
  for (const item of plan.upserts) {
    if (item.actionType !== "quotation_draft" || item.missing.length > 0) continue;
    if (!dealId) {
      item.title = "Quotation needs a deal";
      item.explanation = "The products are clear, but a deal is required before a draft can be saved. Nothing was created.";
      item.missing = ["Deal"];
      continue;
    }
    const lines = Array.isArray(item.payload.items) ? item.payload.items : [];
    const preparedLines = lines
      .map((line) => {
        const row = line as Record<string, unknown>;
        return {
          productId: typeof row.productId === "string" ? row.productId : null,
          name: String(row.name ?? ""),
          quantity: Number(row.quantity),
          unitPrice: row.unitPrice == null ? null : Number(row.unitPrice),
        };
      })
      .filter((line) => line.name && line.quantity > 0);
    const fingerprint = draftFingerprint(preparedLines);
    try {
      const saved = await prepareQuotationDraft({
        clientId,
        leadId,
        dealId,
        actorId: ownerId,
        actorName: "Sales Copilot",
        lines: preparedLines,
        fingerprint,
      });
      const copy = quotationReadyCopy();
      item.title = copy.title;
      item.explanation = copy.explanation;
      item.linkedQuotationId = saved.quotationId;
      item.executionStatus = "succeeded";
      item.reviewStatus = "pending";
      item.payload = { ...item.payload, quotationId: saved.quotationId, fingerprint };
    } catch (err) {
      item.title = "Quotation draft was not saved";
      item.explanation = err instanceof Error ? err.message : "The draft could not be saved.";
      item.executionStatus = "failed";
      item.reviewStatus = "approved";
      item.executionError = item.explanation;
    }
  }

  await persistReconcile({
    clientId,
    leadId,
    ownerId,
    dealId,
    upserts: plan.upserts,
    staleIds: plan.staleIds,
    obsoleteIds: plan.obsoleteIds,
  });
  await saveAnalysis({
    leadId,
    clientId,
    status: enriched.error ? "degraded" : "succeeded",
    contextRevision: analysis.contextRevision,
    summary: analysis.summary,
    facts: {
      facts: analysis.facts,
      needs: analysis.needs,
      objections: analysis.objections,
      questions: analysis.questions,
      uncertainty: analysis.uncertainty,
      waitingActor: analysis.waitingActor,
    },
    lastMessageId: analysis.lastMessageId,
    lastMessageAt: analysis.lastMessageAt,
    error: enriched.error,
    model: enriched.model,
  });
  return { contextRevision: analysis.contextRevision, proposals: analysis.proposals };
}
