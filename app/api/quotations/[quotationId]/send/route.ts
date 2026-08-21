import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { allocateQuoteNumber } from "@/lib/quotations/quote-number";
import { baseQuoteNumber, revisionQuoteNumber } from "@/lib/quotations/copy-quote";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";
import { putObject, getPublicUrl, isR2Configured } from "@/lib/storage/r2";
import { logDocumentSent, logStatusChanged } from "@/lib/lead-events";
import { logQuotationEvent } from "@/lib/quotations/events";
import { proposalDealValueUpdate } from "@/lib/deal-value";
import { persistLeadScore } from "@/lib/lead-scoring";
import { formatMoney } from "@/lib/quotations/totals";
import { getPublicBaseUrl } from "@/lib/constants";
import { sendQuotationOnWhatsApp } from "@/lib/whatsapp/send-quotation";

const ADVANCE_FROM = new Set(["NEW", "CONTACTED", "NEGOTIATING"]);

export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  let expectedCloseDate: string | null | undefined;
  let sendViaWhatsApp = false;
  try {
    const body = (await req.json()) as {
      expected_close_date?: string | null;
      sendViaWhatsApp?: boolean;
    };
    if (body.sendViaWhatsApp === true) sendViaWhatsApp = true;
    if (body.expected_close_date === null) expectedCloseDate = null;
    else if (
      typeof body.expected_close_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.expected_close_date)
    ) {
      expectedCloseDate = body.expected_close_date;
    }
  } catch {
    // Empty body is fine — expected_close_date is optional.
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", params.quotationId)
    .single();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { count: itemCount } = await supabase
    .from("quotation_line_items")
    .select("id", { count: "exact", head: true })
    .eq("quotation_id", params.quotationId);
  if (!itemCount) {
    return NextResponse.json({ error: "Add at least one line item before sending" }, { status: 400 });
  }

  const isResend = quote.status === "sent" || quote.status === "viewed";
  // Phase 1: drafts (and legacy approved rows) can send. Pending approval is Phase 2.
  const canSendFresh = quote.status === "draft" || quote.status === "approved";
  if (!isResend && !canSendFresh) {
    return NextResponse.json(
      { error: "This quotation cannot be sent in its current status" },
      { status: 400 }
    );
  }

  if (isResend) {
    let quoteNumber = (quote.quote_number as string | null) ?? null;
    let publicToken = (quote.public_token as string | null) ?? null;
    if (!quoteNumber) quoteNumber = await allocateQuoteNumber(supabase, access.clientId);
    if (!publicToken) {
      const { randomBytes } = await import("crypto");
      publicToken = randomBytes(32).toString("hex");
      await supabase
        .from("quotations")
        .update({ public_token: publicToken, quote_number: quoteNumber, updated_at: new Date().toISOString() })
        .eq("id", params.quotationId);
    }

    const pdfData = await buildQuotationPdfData(supabase, params.quotationId);
    if (!pdfData) return NextResponse.json({ error: "Failed to assemble quotation" }, { status: 500 });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderQuotationPdf(pdfData);
    } catch (err) {
      console.error("[quotation resend] PDF render error:", err);
      return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
    }

    let pdfUrl = (quote.pdf_url as string | null) ?? null;
    let pdfKey = (quote.pdf_key as string | null) ?? null;
    if (isR2Configured()) {
      try {
        pdfKey = `clients/${access.clientId}/quotations/${quoteNumber}-${Date.now()}.pdf`;
        await putObject(pdfKey, pdfBuffer, "application/pdf");
        pdfUrl = getPublicUrl(pdfKey);
        await supabase
          .from("quotations")
          .update({ pdf_url: pdfUrl, pdf_key: pdfKey, updated_at: new Date().toISOString() })
          .eq("id", params.quotationId);
      } catch (err) {
        console.error("[quotation resend] R2 upload error:", err);
      }
    }

    await logDocumentSent({
      leadId: access.leadId,
      clientId: access.clientId,
      actor: access.actor,
      documentType: "QUOTATION",
      documentName: `Quotation ${quoteNumber} resent — ${formatMoney(Number(quote.total) || 0, (quote.currency as string) || "USD")}`,
      url: pdfUrl ?? `${getPublicBaseUrl()}/quote/${publicToken}`,
    });

    const total = formatMoney(Number(quote.total) || 0, (quote.currency as string) || "USD");
    const firstName = pdfData.customerName?.split(" ")[0] || "there";
    const link = `${getPublicBaseUrl()}/quote/${publicToken}`;
    const waMessage = `Hi ${firstName}, please find your quotation ${quoteNumber} from ${pdfData.companyName} — total ${total}. View and respond here: ${link}`;

    const { data: leadForWhatsApp } = await supabase
      .from("leads")
      .select("phone, source")
      .eq("id", access.leadId)
      .maybeSingle();

    const shouldSendWhatsApp =
      Boolean(leadForWhatsApp?.phone) &&
      (sendViaWhatsApp || leadForWhatsApp?.source === "WHATSAPP_INBOUND");

    if (!leadForWhatsApp?.phone) {
      return NextResponse.json(
        {
          error: "This quotation has no customer phone number to send to.",
          success: false,
          pdfUrl,
          quoteNumber,
          link,
          waMessage,
          whatsappSent: false,
        },
        { status: 400 }
      );
    }

    if (!shouldSendWhatsApp) {
      return NextResponse.json({
        success: true,
        pdfUrl,
        quoteNumber,
        link,
        waMessage,
        whatsappSent: false,
      });
    }

    const waResult = await sendQuotationOnWhatsApp({
      leadId: access.leadId,
      clientId: access.clientId,
      phone: leadForWhatsApp.phone as string,
      actorId: access.actor.id,
      actorName: access.actor.name,
      actorRole: access.actor.role,
      quoteNumber,
      waMessage,
      pdfBuffer,
      pdfUrl,
      publicToken,
    });

    if (!waResult.ok) {
      return NextResponse.json(
        {
          error: waResult.error || "WhatsApp delivery failed",
          success: false,
          pdfUrl,
          quoteNumber,
          link,
          waMessage,
          whatsappSent: false,
          whatsappMode: waResult.mode,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      pdfUrl,
      quoteNumber,
      link,
      waMessage,
      whatsappSent: true,
      whatsappMode: waResult.mode,
    });
  }

  // Allocate a quote number on first send; revisions keep the base number + suffix.
  let quoteNumber = (quote.quote_number as string | null) ?? null;
  if (!quoteNumber) {
    const parentId = quote.parent_quotation_id as string | null;
    if (parentId) {
      const { data: parent } = await supabase
        .from("quotations")
        .select("quote_number")
        .eq("id", parentId)
        .maybeSingle();
      const base = baseQuoteNumber((parent?.quote_number as string | null) ?? null);
      const rev = Number(quote.revision_number) || 2;
      quoteNumber = base ? revisionQuoteNumber(base, rev) : await allocateQuoteNumber(supabase, access.clientId);
    } else {
      quoteNumber = await allocateQuoteNumber(supabase, access.clientId);
    }
  }

  let publicToken = (quote.public_token as string | null) ?? null;
  if (!publicToken) {
    const { randomBytes } = await import("crypto");
    publicToken = randomBytes(32).toString("hex");
  }

  const sentAt = new Date().toISOString();

  // Persist quote number + public link before rendering so the PDF shows the final reference.
  await supabase
    .from("quotations")
    .update({
      quote_number: quoteNumber,
      public_token: publicToken,
      updated_at: sentAt,
    })
    .eq("id", params.quotationId);

  // Render branded PDF first — don't mark as sent until this succeeds.
  const pdfData = await buildQuotationPdfData(supabase, params.quotationId);
  if (!pdfData) return NextResponse.json({ error: "Failed to assemble quotation" }, { status: 500 });

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderQuotationPdf(pdfData);
  } catch (err) {
    console.error("[quotation send] PDF render error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Store on R2 when configured; send still succeeds if storage is unavailable.
  let pdfUrl: string | null = null;
  let pdfKey: string | null = null;
  if (isR2Configured()) {
    try {
      pdfKey = `clients/${access.clientId}/quotations/${quoteNumber}-${Date.now()}.pdf`;
      await putObject(pdfKey, pdfBuffer, "application/pdf");
      pdfUrl = getPublicUrl(pdfKey);
    } catch (err) {
      console.error("[quotation send] R2 upload error:", err);
      pdfKey = null;
      pdfUrl = null;
    }
  }

  await supabase
    .from("quotations")
    .update({
      status: "sent",
      sent_at: sentAt,
      pdf_url: pdfUrl,
      pdf_key: pdfKey,
      updated_at: sentAt,
    })
    .eq("id", params.quotationId);

  // Supersede the parent revision when sending an updated quote.
  const parentId = quote.parent_quotation_id as string | null;
  if (parentId) {
    await supabase
      .from("quotations")
      .update({
        status: "superseded",
        superseded_by_id: params.quotationId,
        updated_at: sentAt,
      })
      .eq("id", parentId)
      .in("status", ["sent", "viewed", "approved", "expired"]);
  }

  // Timeline event.
  await logDocumentSent({
    leadId: access.leadId,
    clientId: access.clientId,
    actor: access.actor,
    documentType: "QUOTATION",
    documentName: `Quotation ${quoteNumber} — ${formatMoney(Number(quote.total) || 0, (quote.currency as string) || "USD")}`,
    url: pdfUrl ?? `${getPublicBaseUrl()}/quote/${publicToken}`,
  });

  await logQuotationEvent(supabase, {
    quotationId: params.quotationId,
    clientId: access.clientId,
    leadId: access.leadId,
    dealId: (quote.deal_id as string) || null,
    actor: { id: access.actor.id, name: access.actor.name },
    eventType: "SENT",
    eventData: {
      quote_number: quoteNumber,
      revision_number: quote.revision_number,
      total: Number(quote.total) || 0,
      channel: sendViaWhatsApp ? "whatsapp" : "link",
    },
  });

  if (parentId) {
    await logQuotationEvent(supabase, {
      quotationId: parentId,
      clientId: access.clientId,
      leadId: access.leadId,
      dealId: (quote.deal_id as string) || null,
      actor: { id: access.actor.id, name: access.actor.name },
      eventType: "SUPERSEDED",
      eventData: { superseded_by_id: params.quotationId },
    });
  }

  // Advance the pipeline to "Proposal sent" if the lead is earlier in the funnel.
  // Optionally capture expected_close_date (forecast input) at send time.
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", access.leadId)
    .single();

  const leadUpdates: Record<string, unknown> = {};
  let advancedToProposal = false;
  if (lead && ADVANCE_FROM.has(lead.status as string)) {
    leadUpdates.status = "PROPOSAL_SENT";
    advancedToProposal = true;
  }
  if (expectedCloseDate !== undefined) {
    leadUpdates.expected_close_date = expectedCloseDate;
  }
  const proposalValue = proposalDealValueUpdate(Number(quote.total) || 0);
  if (proposalValue) Object.assign(leadUpdates, proposalValue);
  if (Object.keys(leadUpdates).length > 0) {
    leadUpdates.updated_at = new Date().toISOString();
    await supabase.from("leads").update(leadUpdates).eq("id", access.leadId);
  }
  if (advancedToProposal && lead) {
    await logStatusChanged({
      leadId: access.leadId,
      clientId: access.clientId,
      actor: access.actor,
      fromStatus: lead.status as string,
      toStatus: "PROPOSAL_SENT",
    });
  }

  void persistLeadScore(access.leadId);

  const total = formatMoney(Number(quote.total) || 0, (quote.currency as string) || "USD");
  const firstName = pdfData.customerName?.split(" ")[0] || "there";
  const link = `${getPublicBaseUrl()}/quote/${publicToken}`;
  const waMessage = `Hi ${firstName}, please find your quotation ${quoteNumber} from ${pdfData.companyName} — total ${total}. View and respond here: ${link}`;

  let whatsappSent = false;
  let whatsappError: string | undefined;
  let whatsappMode: string | undefined;

  const { data: leadForWhatsApp } = await supabase
    .from("leads")
    .select("phone, source")
    .eq("id", access.leadId)
    .maybeSingle();

  const shouldSendWhatsApp =
    Boolean(leadForWhatsApp?.phone) &&
    (sendViaWhatsApp || leadForWhatsApp?.source === "WHATSAPP_INBOUND");

  if (shouldSendWhatsApp && leadForWhatsApp?.phone) {
    const waResult = await sendQuotationOnWhatsApp({
      leadId: access.leadId,
      clientId: access.clientId,
      phone: leadForWhatsApp.phone as string,
      actorId: access.actor.id,
      actorName: access.actor.name,
      actorRole: access.actor.role,
      quoteNumber,
      waMessage,
      pdfBuffer,
      pdfUrl,
      publicToken,
    });
    whatsappSent = waResult.ok;
    whatsappMode = waResult.mode;
    if (!waResult.ok) whatsappError = waResult.error;
  }

  return NextResponse.json({
    success: true,
    pdfUrl,
    quoteNumber,
    link,
    waMessage,
    whatsappSent,
    whatsappError,
    whatsappMode,
  });
}
