import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { allocateQuoteNumber } from "@/lib/quotations/quote-number";
import { baseQuoteNumber, revisionQuoteNumber } from "@/lib/quotations/copy-quote";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { logDocumentSent, logStatusChanged } from "@/lib/lead-events";
import { persistLeadScore } from "@/lib/lead-scoring";
import { formatMoney } from "@/lib/quotations/totals";
import { getPublicBaseUrl } from "@/lib/constants";

const ADVANCE_FROM = new Set(["NEW", "CONTACTED", "NEGOTIATING"]);

export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

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
  if (quote.status !== "draft") {
    return NextResponse.json({ error: "Only draft quotations can be sent" }, { status: 400 });
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
  await supabase
    .from("quotations")
    .update({
      quote_number: quoteNumber,
      public_token: publicToken,
      status: "sent",
      sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("id", params.quotationId);

  // Supersede the parent revision when sending an updated quote.
  const parentId = quote.parent_quotation_id as string | null;
  if (parentId) {
    await supabase
      .from("quotations")
      .update({
        status: "expired",
        superseded_by_id: params.quotationId,
        updated_at: sentAt,
      })
      .eq("id", parentId)
      .in("status", ["sent", "viewed"]);
  }

  // Render branded PDF and store on R2.
  const pdfData = await buildQuotationPdfData(supabase, params.quotationId);
  if (!pdfData) return NextResponse.json({ error: "Failed to assemble quotation" }, { status: 500 });

  let pdfUrl: string;
  try {
    const buffer = await renderQuotationPdf(pdfData);
    const key = `clients/${access.clientId}/quotations/${quoteNumber}-${Date.now()}.pdf`;
    await putObject(key, buffer, "application/pdf");
    pdfUrl = getPublicUrl(key);
    await supabase
      .from("quotations")
      .update({ pdf_url: pdfUrl, pdf_key: key, updated_at: new Date().toISOString() })
      .eq("id", params.quotationId);
  } catch (err) {
    console.error("[quotation send] PDF/R2 error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }

  // Timeline event.
  await logDocumentSent({
    leadId: access.leadId,
    clientId: access.clientId,
    actor: access.actor,
    documentType: "QUOTATION",
    documentName: `Quotation ${quoteNumber} — ${formatMoney(Number(quote.total) || 0, (quote.currency as string) || "USD")}`,
    url: pdfUrl,
  });

  // Advance the pipeline to "Proposal sent" if the lead is earlier in the funnel.
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", access.leadId)
    .single();
  if (lead && ADVANCE_FROM.has(lead.status as string)) {
    await supabase
      .from("leads")
      .update({ status: "PROPOSAL_SENT", updated_at: new Date().toISOString() })
      .eq("id", access.leadId);
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

  return NextResponse.json({ success: true, pdfUrl, quoteNumber, link, waMessage });
}
