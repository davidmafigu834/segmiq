import { addDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicBaseUrl } from "@/lib/constants";
import { logLeadEvent } from "@/lib/lead-events";
import { evaluateApprovalRequirement } from "@/lib/quotations/approval-engine";
import { runCommercialCheck, totalsForCheck } from "@/lib/quotations/commercial-check";
import { logQuotationEvent } from "@/lib/quotations/events";
import { evaluateGovernance } from "@/lib/quotations/governance";
import { loadPolicies } from "@/lib/quotations/evaluate-send";
import { expandPackageToLineItems, type PackageComponentInput } from "@/lib/quotations/packages";
import { loadQuotationWithItems, saveItemsAndTotals } from "@/lib/quotations/persist";
import { allocateQuoteNumber, ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { loadTemplateWithItems } from "@/lib/quotations/templates";
import { sendCanonicalWhatsAppText } from "@/lib/whatsapp/message-service";
import { getSafeWhatsAppConnection } from "@/lib/whatsapp/connections";
import type { QuotationLineItemInput } from "@/types";
import { evaluateQuoteAutoSend } from "../policy";
import { AGENT_ACTOR, toolFailure, toolSuccess, type ToolExecutionContext, type ToolResult } from "./context";

/**
 * Quotation tools. Drafts are created in the canonical quotations workflow
 * (same tables, numbering, events and Commercial Check as human-created
 * quotes). The agent evaluates governance with the SALESPERSON role so it
 * never inherits manager bypasses.
 */

const AGENT_GOVERNANCE_ROLE = "SALESPERSON";

export function isBuiltinQuoteTemplate(row: {
  is_builtin?: boolean | null;
  builtin_key?: string | null;
}): boolean {
  return Boolean(row.is_builtin) || Boolean(row.builtin_key);
}

export function packageHasSellableComponents(
  components: Array<{ unit_price?: number | string | null }>,
  fixedPrice: number | null
): boolean {
  if (fixedPrice != null && Number(fixedPrice) > 0) return true;
  return components.some((c) => Number(c.unit_price) > 0);
}

export function catalogSearchNote(opts: {
  readyPackageCount: number;
  packageCount: number;
  productCount: number;
}): string {
  if (opts.readyPackageCount > 0) {
    return "Quote only from a ready_to_quote package. Presentation templates are PDF layouts, not product catalogues — never copy their sample line items.";
  }
  if (opts.packageCount > 0 || opts.productCount > 0) {
    return "No priced package is ready to quote. Escalate — do not invent prices or use a presentation template as the product list.";
  }
  return "No matching approved catalogue items. Do not invent prices — confirm with the team.";
}

type CheckSummary = {
  can_send: boolean;
  approval_required: boolean;
  blocking: string[];
  warnings: string[];
};

function summarizeCheck(check: ReturnType<typeof runCommercialCheck>): CheckSummary {
  return {
    can_send: check.canSend,
    approval_required: check.approvalRequired,
    blocking: check.items.filter((i) => i.status === "block").map((i) => i.action ?? i.label),
    warnings: check.items.filter((i) => i.status === "warn").map((i) => i.action ?? i.label),
  };
}

async function evaluateQuotation(
  clientId: string,
  quote: Record<string, unknown>
): Promise<{ check: ReturnType<typeof runCommercialCheck>; total: number }> {
  const supabase = createAdminClient();
  const items = (quote.items as QuotationLineItemInput[]) ?? [];
  const settings = await ensureQuotationSettings(supabase, clientId);
  const policies = await loadPolicies(supabase, clientId);
  const totals = totalsForCheck(
    items,
    Number(quote.tax_rate) || 0,
    Number(quote.other_amount) || 0,
    Number(quote.discount_percent) || 0
  );
  const governance = evaluateGovernance({
    items,
    totals,
    settings,
    role: AGENT_GOVERNANCE_ROLE,
    paymentTermsLabel: (quote.payment_terms_label as string | null) ?? null,
    defaultPaymentTerms: (settings.default_payment_terms as string | null) ?? null,
  });
  const approval = evaluateApprovalRequirement({
    items,
    totals,
    settings,
    policies,
    role: AGENT_GOVERNANCE_ROLE,
    paymentTermsLabel: (quote.payment_terms_label as string | null) ?? null,
  });
  const check = runCommercialCheck({
    status: String(quote.status),
    approvalStatus: (quote.approval_status as string | null) ?? null,
    customerName: quote.customer_name as string | null,
    dealId: quote.deal_id as string | null,
    currency: quote.currency as string | null,
    validUntil: quote.valid_until as string | null,
    paymentTermsLabel: quote.payment_terms_label as string | null,
    items,
    totals,
    governance,
    approval,
  });
  return { check, total: totals.total };
}

export async function executeGetCurrentQuotation(ctx: ToolExecutionContext): Promise<ToolResult> {
  const supabase = createAdminClient();
  const { data: quotes } = await supabase
    .from("quotations")
    .select("id, quote_number, status, total, currency, valid_until, deal_id, created_at, superseded_by_id")
    .eq("lead_id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);

  const quote = quotes?.[0];
  if (!quote) {
    return toolSuccess({ quotation: null, note: "No quotation exists yet for this customer." });
  }

  const full = await loadQuotationWithItems(supabase, quote.id as string);
  const evaluation = full ? await evaluateQuotation(ctx.clientId, full) : null;

  return toolSuccess({
    quotation: {
      id: quote.id,
      number: quote.quote_number,
      status: quote.status,
      total: Number(quote.total) || 0,
      currency: quote.currency,
      valid_until: quote.valid_until,
      commercial_check: evaluation ? summarizeCheck(evaluation.check) : null,
    },
  });
}

export async function executePrepareQuotationDraft(
  ctx: ToolExecutionContext,
  input: { package_id: string; template_id?: string; note_to_team?: string }
): Promise<ToolResult> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, name, phone, email, active_deal_id")
    .eq("id", ctx.leadId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (!lead) return toolFailure("Lead not found.");

  const dealId = (lead.active_deal_id as string | null) ?? null;
  if (!dealId) {
    return toolFailure(
      "No active Deal exists for this customer. Create a Deal first (deal_create) once qualification is sufficient."
    );
  }
  const { data: deal } = await supabase
    .from("deals")
    .select("id, client_id, originating_lead_id, owner_id, name")
    .eq("id", dealId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();
  if (!deal || deal.originating_lead_id !== ctx.leadId) {
    return toolFailure("The active Deal could not be verified for this customer.");
  }

  if (!input.package_id) {
    return toolFailure(
      "Quotations must be built from an approved package with priced components. Do not use a presentation template as the product list. If no suitable package exists, escalate."
    );
  }

  const settings = await ensureQuotationSettings(supabase, ctx.clientId);

  const { data: pkg } = await supabase
    .from("quotation_packages")
    .select("*")
    .eq("id", input.package_id)
    .eq("client_id", ctx.clientId)
    .eq("is_active", true)
    .maybeSingle();
  if (!pkg) return toolFailure("Package not found in this company's approved catalogue.");
  const { data: components } = await supabase
    .from("quotation_package_components")
    .select("*")
    .eq("package_id", pkg.id as string)
    .order("display_order", { ascending: true });
  const componentRows = (components ?? []) as unknown as PackageComponentInput[];
  if (!packageHasSellableComponents(componentRows, pkg.fixed_price == null ? null : Number(pkg.fixed_price))) {
    return toolFailure(
      `Package "${pkg.name as string}" has no priced components. Add products and selling prices in the catalogue, then retry — do not quote from a presentation template.`
    );
  }
  const items = expandPackageToLineItems({
    packageId: pkg.id as string,
    packageName: pkg.name as string,
    pricingModel: pkg.pricing_model as string,
    flexibility: pkg.flexibility as string,
    fixedPrice: pkg.fixed_price == null ? null : Number(pkg.fixed_price),
    discountPercent: Number(pkg.discount_percent) || 0,
    components: componentRows,
  });
  if (!items.length) return toolFailure("The selected package has no components. Escalate for human review.");
  const sourceLabel = `package "${pkg.name as string}"`;

  let templateId: string | null = null;
  let taxRate = Number(settings.default_tax_rate) || 0;
  let otherAmount = 0;
  let paymentTerms = (settings.default_payment_terms as string | null)?.trim() || null;
  let validDays = settings.default_validity_days != null ? Number(settings.default_validity_days) : 14;
  let notes: string | null = null;
  let terms: string | null = (settings.default_terms as string | null) ?? null;
  let templateLayoutKey: string | null = null;
  let templateLayoutVersion: number | null = null;

  if (input.template_id) {
    const template = await loadTemplateWithItems(supabase, input.template_id);
    if (!template || template.client_id !== ctx.clientId) {
      return toolFailure("Template not found for this company.");
    }
    templateId = template.id as string;
    templateLayoutKey = (template.layout_key as string | null) ?? null;
    templateLayoutVersion =
      template.layout_version == null ? null : Number(template.layout_version);
    // Builtin layouts are presentation only — never copy sample BOM, notes, or demo terms.
    if (!isBuiltinQuoteTemplate(template)) {
      taxRate = Number(template.tax_rate) || taxRate;
      otherAmount = Number(template.other_amount) || 0;
      notes = (template.notes as string | null) ?? notes;
      terms = (template.terms as string | null) ?? terms;
      validDays = Number(template.valid_for_days) || validDays;
      paymentTerms = ((template.payment_terms_label as string | null) ?? "").trim() || paymentTerms;
    }
  }

  if (ctx.testMode) {
    const totals = totalsForCheck(items, taxRate, otherAmount);
    return toolSuccess({
      simulated: true,
      source: sourceLabel,
      item_count: items.length,
      estimated_total: totals.total,
      currency: (settings.default_currency as string) || "USD",
    });
  }

  const quoteNumber = await allocateQuoteNumber(supabase, ctx.clientId);
  const validUntil = format(addDays(new Date(), validDays > 0 ? validDays : 14), "yyyy-MM-dd");

  const preparedByName = ctx.ownerName ?? "SegmiQ Agent";
  const { data: created, error } = await supabase
    .from("quotations")
    .insert({
      client_id: ctx.clientId,
      lead_id: ctx.leadId,
      deal_id: dealId,
      quote_number: quoteNumber,
      status: "draft",
      customer_name: (lead.name as string | null) ?? null,
      customer_phone: (lead.phone as string | null) ?? null,
      customer_email: (lead.email as string | null) ?? null,
      tax_rate: taxRate,
      other_amount: otherAmount,
      currency: (settings.default_currency as string) || "USD",
      valid_until: validUntil,
      notes,
      terms,
      payment_terms_label: paymentTerms,
      prepared_by_id: ctx.ownerId,
      prepared_by_name: preparedByName,
      revision_number: 1,
      template_id: templateId,
      template_layout_key: templateLayoutKey,
      template_layout_version: templateLayoutVersion,
      template_fields: {},
    })
    .select("*")
    .single();
  if (error || !created) {
    return toolFailure(`Could not create the quotation draft: ${error?.message ?? "unknown error"}`);
  }

  await saveItemsAndTotals(supabase, created.id as string, items, taxRate, otherAmount);

  await logQuotationEvent(supabase, {
    quotationId: created.id as string,
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    dealId,
    actor: { id: null, name: "SegmiQ Agent" },
    eventType: "CREATED",
    eventData: {
      quote_number: quoteNumber,
      deal_id: dealId,
      prepared_by: "SEGMIQ_AGENT",
      source: sourceLabel,
      note_to_team: input.note_to_team ?? null,
    },
  });
  await logLeadEvent({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    eventType: "NOTE_ADDED",
    eventData: {
      note: `Quotation ${quoteNumber} prepared by SegmiQ Agent from ${sourceLabel}.`,
      agent: true,
    },
  });

  const full = await loadQuotationWithItems(supabase, created.id as string);
  const evaluation = full ? await evaluateQuotation(ctx.clientId, full) : null;

  return toolSuccess(
    {
      quotation_id: created.id,
      quote_number: quoteNumber,
      total: evaluation?.total ?? 0,
      currency: (settings.default_currency as string) || "USD",
      valid_until: validUntil,
      source: sourceLabel,
      commercial_check: evaluation ? summarizeCheck(evaluation.check) : null,
      sent_to_customer: false,
    },
    { type: "quotation", id: created.id as string }
  );
}

export async function executeSendQuotation(
  ctx: ToolExecutionContext,
  input: { quotation_id: string }
): Promise<ToolResult> {
  const supabase = createAdminClient();

  const full = await loadQuotationWithItems(supabase, input.quotation_id);
  if (!full || full.client_id !== ctx.clientId || full.lead_id !== ctx.leadId) {
    return toolFailure("Quotation not found for this customer.");
  }

  const evaluation = await evaluateQuotation(ctx.clientId, full);
  const connection = await getSafeWhatsAppConnection(ctx.clientId);

  const decision = evaluateQuoteAutoSend(
    {
      total: evaluation.total,
      commercialCheckPassed: evaluation.check.canSend,
      approvalRequired: evaluation.check.approvalRequired,
      connectionHealthy: connection.connected,
    },
    ctx.settings
  );
  if (!decision.allowed) {
    return toolFailure(`Autonomous send blocked: ${decision.reason}`, {
      commercial_check: summarizeCheck(evaluation.check),
      requires_human: true,
    });
  }

  if (ctx.testMode) {
    return toolSuccess({ simulated: true, would_send: true, total: evaluation.total });
  }

  // Allocate the public link, mark sent, deliver — mirroring the canonical
  // send flow (PDF is rendered on demand from the public link).
  let publicToken = (full.public_token as string | null) ?? null;
  if (!publicToken) {
    const { randomBytes } = await import("crypto");
    publicToken = randomBytes(32).toString("hex");
  }
  const sentAt = new Date().toISOString();
  const quoteNumber = (full.quote_number as string) ?? "";
  const link = `${getPublicBaseUrl()}/quote/${publicToken}`;

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name")
    .eq("id", ctx.clientId)
    .maybeSingle();
  const companyName = (clientRow?.name as string | null) ?? "our team";
  const customerFirst = ((full.customer_name as string | null) ?? "there").split(" ")[0] || "there";
  const currency = (full.currency as string) || "USD";
  const totalLabel = `${currency} ${evaluation.total.toLocaleString()}`;
  const waMessage = `Hi ${customerFirst}, please find your quotation ${quoteNumber} from ${companyName} — total ${totalLabel}. View and respond here: ${link}`;

  await supabase
    .from("quotations")
    .update({ public_token: publicToken, status: "sent", sent_at: sentAt, updated_at: sentAt })
    .eq("id", input.quotation_id)
    .eq("client_id", ctx.clientId);

  const sendResult = await sendCanonicalWhatsAppText({
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    to: (full.customer_phone as string | null) ?? "",
    body: waMessage,
    actorId: null,
    actorName: "SegmiQ Agent",
    actorRole: "SYSTEM",
  });

  if (!sendResult.ok) {
    // Truthful state: delivery failed, so the quote is not "sent".
    await supabase
      .from("quotations")
      .update({ status: "draft", sent_at: null, updated_at: new Date().toISOString() })
      .eq("id", input.quotation_id)
      .eq("client_id", ctx.clientId);
    return toolFailure(
      `WhatsApp delivery failed (${sendResult.error ?? "unknown"}). The quotation was NOT sent — do not tell the customer it was.`
    );
  }

  await logQuotationEvent(supabase, {
    quotationId: input.quotation_id,
    clientId: ctx.clientId,
    leadId: ctx.leadId,
    dealId: (full.deal_id as string | null) ?? null,
    actor: { id: null, name: "SegmiQ Agent" },
    eventType: "SENT",
    eventData: { quote_number: quoteNumber, autonomous: true, total: evaluation.total },
  });
  await logLeadEvent({
    leadId: ctx.leadId,
    clientId: ctx.clientId,
    actor: AGENT_ACTOR,
    eventType: "DOCUMENT_SENT",
    eventData: {
      document_type: "QUOTATION",
      document_name: `Quotation ${quoteNumber} — ${totalLabel} (sent autonomously by SegmiQ Agent)`,
      url: link,
    },
    channel: "whatsapp",
  });

  const { hookQuotationSent } = await import("@/lib/agent/proactive");
  void hookQuotationSent({
    clientId: ctx.clientId,
    quotationId: input.quotation_id,
    leadId: ctx.leadId,
    dealId: (full.deal_id as string) || null,
    revisionNumber: Number(full.revision_number) || 1,
    validUntil: (full.valid_until as string) || null,
    quoteNumber,
    actorType: "AGENT",
  });

  return toolSuccess(
    { sent: true, quote_number: quoteNumber, total: evaluation.total, link },
    { type: "quotation_send", id: input.quotation_id }
  );
}
