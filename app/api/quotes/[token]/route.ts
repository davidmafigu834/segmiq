import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logStatusChanged } from "@/lib/lead-events";
import { proposalDealValueUpdate } from "@/lib/deal-value";
import { logQuotationEvent } from "@/lib/quotations/events";
import { recordCustomerView } from "@/lib/quotations/engagement";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import { computeCustomerSelectedTotals } from "@/lib/quotations/selected-totals";
import { notifyQuotationAlert } from "@/lib/quotations/notify";
import type { QuotationLineItemInput } from "@/types";

export const dynamic = "force-dynamic";

const RESPONDABLE = new Set(["sent", "viewed"]);

async function loadByToken(token: string) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  return { supabase, quote };
}

function isExpired(quote: Record<string, unknown>): boolean {
  if (!quote.valid_until) return false;
  if (quote.status === "accepted" || quote.status === "rejected" || quote.status === "superseded") {
    return false;
  }
  return new Date(`${quote.valid_until as string}T23:59:59`) < new Date();
}

async function isInternalViewer(clientId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return false;
  if (session.role === "SUPER_ADMIN") return true;
  return session.clientId === clientId;
}

async function setDealNextAction(
  supabase: ReturnType<typeof createAdminClient>,
  dealId: string | null,
  label: string
) {
  if (!dealId) return;
  const due = new Date();
  due.setHours(due.getHours() + 4);
  await supabase
    .from("deals")
    .update({
      next_action_at: due.toISOString(),
      next_action_label: label,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId)
    .neq("stage", "WON")
    .neq("stage", "LOST");
}

/** Public quotation fetch — marks as viewed on first genuine customer open. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const { supabase, quote } = await loadByToken(params.token);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.link_revoked_at) {
    return NextResponse.json({ error: "This link is no longer active" }, { status: 410 });
  }

  if (isExpired(quote) && quote.status !== "accepted" && quote.status !== "rejected") {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string)
      .in("status", ["sent", "viewed"]);
    quote.status = "expired";
  }

  const internal = await isInternalViewer(quote.client_id as string);
  if (!internal && (quote.status === "sent" || quote.status === "viewed")) {
    const result = await recordCustomerView(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: (quote.lead_id as string) ?? null,
      dealId: (quote.deal_id as string) ?? null,
      publicToken: params.token,
      userAgent: req.headers.get("user-agent"),
      currentStatus: quote.status as string,
      viewedAt: (quote.viewed_at as string | null) ?? null,
      lastViewedAt: (quote.last_viewed_at as string | null) ?? null,
      viewCount: Number(quote.view_count) || 0,
      ownerId: (quote.prepared_by_id as string | null) ?? null,
    });
    quote.status = quote.status === "sent" ? "viewed" : quote.status;
    quote.view_count = result.viewCount;
    if (result.firstView && quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `${quote.quote_number || "Quotation"} was viewed`,
      });
    }
  }

  const [{ data: items }, { data: client }, { data: settings }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select(
        "id, item_name, description, unit_price, quantity, amount, group_label, sort_order, section_id, unit, sku, discount_percent, tax_rate, is_optional, offer_option_id, package_id"
      )
      .eq("quotation_id", quote.id as string)
      .order("sort_order", { ascending: true }),
    supabase
      .from("clients")
      .select("name, logo_url, primary_color")
      .eq("id", quote.client_id as string)
      .maybeSingle(),
    supabase
      .from("quotation_settings")
      .select(
        "company_email, company_phone, company_address, footer_note, brand_footer, bank_details, tax_registration, legal_registration, customer_allow_accept, customer_allow_request_changes, customer_allow_ask_question, customer_allow_decline, customer_allow_option_selection, require_acceptance_name, require_acceptance_checkbox"
      )
      .eq("client_id", quote.client_id as string)
      .maybeSingle(),
  ]);

  const lineInputs = (items ?? []) as QuotationLineItemInput[];
  const totals = computeQuotationTotals(lineInputs, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });

  return NextResponse.json({
    quotation: {
      ...quote,
      items: items ?? [],
      computed: totals,
      brand: {
        companyName: (client?.name as string | null) || "Company",
        logoUrl: (client?.logo_url as string | null) ?? null,
        brandColor: (client?.primary_color as string | null) || "#0F7A4F",
        companyEmail: (settings?.company_email as string | null) ?? null,
        companyPhone: (settings?.company_phone as string | null) ?? null,
        companyAddress: (settings?.company_address as string | null) ?? null,
        footerNote: (settings?.brand_footer as string | null) ?? (settings?.footer_note as string | null) ?? null,
        taxRegistration: (settings?.tax_registration as string | null) ?? null,
        legalRegistration: (settings?.legal_registration as string | null) ?? null,
        bankDetails: (settings?.bank_details as string | null) ?? null,
      },
      customerActions: {
        accept: settings?.customer_allow_accept !== false,
        requestChanges: settings?.customer_allow_request_changes !== false,
        askQuestion: settings?.customer_allow_ask_question !== false,
        decline: settings?.customer_allow_decline !== false,
        optionSelection: settings?.customer_allow_option_selection !== false,
        requireName: Boolean(settings?.require_acceptance_name),
        requireCheckbox: settings?.require_acceptance_checkbox !== false,
      },
    },
  });
}

/** Public customer response: accept, decline, request changes, ask question, select option. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { supabase, quote } = await loadByToken(params.token);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.link_revoked_at) {
    return NextResponse.json({ error: "This link is no longer active" }, { status: 410 });
  }
  if (quote.status === "superseded") {
    return NextResponse.json(
      { error: "A newer version of this quotation is available.", superseded: true, supersededById: quote.superseded_by_id },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    name?: string;
    confirmed?: boolean;
    category?: string;
    message?: string;
    selectedOptionalIds?: string[];
    selectedOfferOptionId?: string | null;
  };
  const action = body.action;
  const { data: settings } = await supabase
    .from("quotation_settings")
    .select(
      "customer_allow_accept, customer_allow_request_changes, customer_allow_ask_question, customer_allow_decline, customer_allow_option_selection, require_acceptance_name, require_acceptance_checkbox"
    )
    .eq("client_id", quote.client_id as string)
    .maybeSingle();

  if (action === "select_option") {
    if (settings?.customer_allow_option_selection === false) {
      return NextResponse.json({ error: "Option selection is not enabled" }, { status: 403 });
    }
    if (!RESPONDABLE.has(quote.status as string) && quote.status !== "expired") {
      return NextResponse.json({ error: "This quotation cannot be updated" }, { status: 409 });
    }
    const { data: items } = await supabase
      .from("quotation_line_items")
      .select("*")
      .eq("quotation_id", quote.id as string);
    const selected = body.selectedOptionalIds ?? [];
    const selectedTotal = computeCustomerSelectedTotals(
      (items ?? []) as QuotationLineItemInput[],
      selected,
      {
        fallbackTaxRate: Number(quote.tax_rate) || 0,
        otherAmount: Number(quote.other_amount) || 0,
        discountPercent: Number(quote.discount_percent) || 0,
      }
    );
    const config = {
      selected_optional_keys: selected,
      selected_offer_option_id: body.selectedOfferOptionId ?? null,
      selected_total: selectedTotal.total,
    };
    await supabase
      .from("quotations")
      .update({
        customer_configuration: config,
        selected_offer_option_id: body.selectedOfferOptionId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id as string);
    await logQuotationEvent(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: quote.lead_id as string,
      dealId: (quote.deal_id as string) || null,
      actor: { id: null, name: "Customer" },
      eventType: "CUSTOMER_SELECTED_OPTION",
      eventData: config,
    });
    if (quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `Customer selected an option on ${quote.quote_number || "quotation"}`,
      });
    }
    return NextResponse.json({ success: true, selectedTotal: selectedTotal.total, configuration: config });
  }

  const status = quote.status as string;
  if (status === "accepted" || status === "rejected") {
    return NextResponse.json({ error: "This quotation has already been responded to" }, { status: 409 });
  }
  if (status === "expired" || isExpired(quote)) {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string)
      .in("status", ["sent", "viewed"]);
    if (action === "accept") {
      return NextResponse.json({ error: "This quotation has expired" }, { status: 410 });
    }
  }
  if (!RESPONDABLE.has(status) && status !== "expired") {
    return NextResponse.json({ error: "This quotation cannot be responded to" }, { status: 409 });
  }

  const respondedAt = new Date().toISOString();
  const dealId = (quote.deal_id as string) || null;

  if (action === "request_changes") {
    if (settings?.customer_allow_request_changes === false) {
      return NextResponse.json({ error: "Requesting changes is not enabled" }, { status: 403 });
    }
    await supabase
      .from("quotations")
      .update({
        customer_response_type: "request_changes",
        customer_response_category: body.category ?? null,
        customer_response_message: body.message?.trim() || null,
        responded_at: respondedAt,
        updated_at: respondedAt,
      })
      .eq("id", quote.id as string);
    await logQuotationEvent(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: quote.lead_id as string,
      dealId,
      actor: { id: null, name: "Customer" },
      eventType: "CUSTOMER_REQUESTED_CHANGES",
      eventData: { category: body.category ?? null, message: body.message?.trim() || null },
    });
    await setDealNextAction(supabase, dealId, "Review customer quotation change request");
    if (quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `Customer requested changes on ${quote.quote_number || "quotation"}`,
      });
    }
    return NextResponse.json({ success: true, status: "request_changes" });
  }

  if (action === "ask_question") {
    if (settings?.customer_allow_ask_question === false) {
      return NextResponse.json({ error: "Questions are not enabled" }, { status: 403 });
    }
    const message = body.message?.trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    await logQuotationEvent(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: quote.lead_id as string,
      dealId,
      actor: { id: null, name: "Customer" },
      eventType: "CUSTOMER_ASKED_QUESTION",
      eventData: { message },
    });
    await setDealNextAction(supabase, dealId, "Reply to customer quotation question");
    if (quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `Customer asked a question on ${quote.quote_number || "quotation"}`,
      });
    }
    return NextResponse.json({
      success: true,
      status: "question",
      whatsappHint: Boolean(quote.customer_phone),
    });
  }

  if (action === "accept") {
    if (settings?.customer_allow_accept === false) {
      return NextResponse.json({ error: "Acceptance is not enabled" }, { status: 403 });
    }
    if (settings?.require_acceptance_checkbox !== false && body.confirmed !== true) {
      return NextResponse.json({ error: "Please confirm acceptance" }, { status: 400 });
    }
    if (settings?.require_acceptance_name && !body.name?.trim()) {
      return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
    }
    const { data: items } = await supabase
      .from("quotation_line_items")
      .select("*")
      .eq("quotation_id", quote.id as string);
    const selected = body.selectedOptionalIds ??
      ((quote.customer_configuration as { selected_optional_keys?: string[] } | null)?.selected_optional_keys ?? []);
    const selectedTotal = computeCustomerSelectedTotals((items ?? []) as QuotationLineItemInput[], selected, {
      fallbackTaxRate: Number(quote.tax_rate) || 0,
      otherAmount: Number(quote.other_amount) || 0,
      discountPercent: Number(quote.discount_percent) || 0,
    });
    const snapshot = {
      quotationId: quote.id,
      revision: quote.revision_number,
      quoteNumber: quote.quote_number,
      acceptedTotal: selectedTotal.total,
      currency: quote.currency,
      selectedOptionalIds: selected,
      selectedOfferOptionId: body.selectedOfferOptionId ?? quote.selected_offer_option_id ?? null,
      terms: quote.terms_snapshot ?? quote.terms,
      acceptedByName: body.name?.trim() || null,
      acceptedAt: respondedAt,
    };
    await supabase
      .from("quotations")
      .update({
        status: "accepted",
        responded_at: respondedAt,
        accepted_at: respondedAt,
        accepted_total: selectedTotal.total,
        accepted_snapshot: snapshot,
        accepted_by_name: body.name?.trim() || null,
        customer_configuration: {
          selected_optional_keys: selected,
          selected_offer_option_id: snapshot.selectedOfferOptionId,
          selected_total: selectedTotal.total,
        },
        customer_response_type: "accepted",
        updated_at: respondedAt,
      })
      .eq("id", quote.id as string);

    await logQuotationEvent(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: quote.lead_id as string,
      dealId,
      actor: { id: null, name: body.name?.trim() || "Customer" },
      eventType: "ACCEPTED",
      eventData: snapshot,
    });

    const proposalValue = proposalDealValueUpdate(selectedTotal.total);
    if (proposalValue) {
      await supabase.from("leads").update(proposalValue).eq("id", quote.lead_id as string);
    }
    const { data: lead } = await supabase
      .from("leads")
      .select("status")
      .eq("id", quote.lead_id as string)
      .maybeSingle();
    if (lead && lead.status !== "WON") {
      const fromStatus = lead.status as string;
      await supabase
        .from("leads")
        .update({ status: "NEGOTIATING", updated_at: respondedAt })
        .eq("id", quote.lead_id as string);
      await logStatusChanged({
        leadId: quote.lead_id as string,
        clientId: quote.client_id as string,
        actor: { id: null, name: "Customer", role: "CUSTOMER" },
        fromStatus,
        toStatus: "NEGOTIATING",
      });
    }
    await setDealNextAction(supabase, dealId, "Confirm next commercial step");
    if (quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `${quote.quote_number || "Quotation"} was accepted`,
      });
    }
    return NextResponse.json({ success: true, status: "accepted" });
  }

  if (action === "reject" || action === "decline") {
    if (settings?.customer_allow_decline === false) {
      return NextResponse.json({ error: "Decline is not enabled" }, { status: 403 });
    }
    await supabase
      .from("quotations")
      .update({
        status: "rejected",
        responded_at: respondedAt,
        declined_reason: body.message?.trim() || null,
        declined_category: body.category ?? null,
        customer_response_type: "declined",
        customer_response_category: body.category ?? null,
        customer_response_message: body.message?.trim() || null,
        updated_at: respondedAt,
      })
      .eq("id", quote.id as string);
    await logQuotationEvent(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: quote.lead_id as string,
      dealId,
      actor: { id: null, name: "Customer" },
      eventType: "DECLINED",
      eventData: { category: body.category ?? null, message: body.message?.trim() || null },
    });
    await setDealNextAction(supabase, dealId, "Review Deal after quotation decline");
    if (quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `${quote.quote_number || "Quotation"} was declined`,
      });
    }
    return NextResponse.json({ success: true, status: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
