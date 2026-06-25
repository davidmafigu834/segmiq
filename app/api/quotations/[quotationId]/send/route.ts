import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { allocateQuoteNumber } from "@/lib/quotations/quote-number";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { logDocumentSent, logStatusChanged } from "@/lib/lead-events";
import { persistLeadScore } from "@/lib/lead-scoring";
import { formatMoney } from "@/lib/quotations/totals";

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

  // Allocate a quote number on first send; keep it stable on re-sends.
  let quoteNumber = (quote.quote_number as string | null) ?? null;
  if (!quoteNumber) {
    quoteNumber = await allocateQuoteNumber(supabase, access.clientId);
  }

  const sentAt = new Date().toISOString();
  await supabase
    .from("quotations")
    .update({ quote_number: quoteNumber, status: "sent", sent_at: sentAt, updated_at: sentAt })
    .eq("id", params.quotationId);

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
  const waMessage = `Hi ${firstName}, please find your quotation ${quoteNumber} from ${pdfData.companyName} — total ${total}. Let me know if you have any questions.`;

  return NextResponse.json({ success: true, pdfUrl, quoteNumber, waMessage });
}
