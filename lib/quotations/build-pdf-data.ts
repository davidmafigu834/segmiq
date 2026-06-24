import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuotationPdfData } from "@/lib/quotations/quotation-pdf";
import { ensureQuotationSettings } from "@/lib/quotations/quote-number";

async function fetchLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null; // guard against huge files
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Short, human-friendly customer reference derived from the lead id. */
function customerRef(leadId: string): string {
  return `C${leadId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
}

/**
 * Assemble everything the quotation PDF renderer needs from the stored
 * quotation + its line items + client branding + quote settings.
 */
export async function buildQuotationPdfData(
  supabase: SupabaseClient,
  quotationId: string
): Promise<QuotationPdfData | null> {
  const { data: quote } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .maybeSingle();
  if (!quote) return null;

  const clientId = quote.client_id as string;

  const [{ data: items }, { data: client }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("clients")
      .select("name, logo_url, primary_color")
      .eq("id", clientId)
      .maybeSingle(),
  ]);

  const settings = await ensureQuotationSettings(supabase, clientId);
  const logoDataUri = await fetchLogoDataUri((client?.logo_url as string | null) ?? null);

  return {
    brandColor: (client?.primary_color as string | null) || "#0F7A4F",
    logoDataUri,
    companyName: (client?.name as string | null) || "Company",
    companyAddress: (settings.company_address as string | null) ?? null,
    companyPhone: (settings.company_phone as string | null) ?? null,
    companyEmail: (settings.company_email as string | null) ?? null,
    companyWebsite: (settings.company_website as string | null) ?? null,

    quoteNumber: (quote.quote_number as string | null) || "DRAFT",
    issuedAt: quote.sent_at ? new Date(quote.sent_at as string) : new Date(),
    validUntil: quote.valid_until ? new Date(`${quote.valid_until as string}T12:00:00`) : null,
    preparedBy: (quote.prepared_by_name as string | null) ?? null,
    customerId: customerRef(quote.lead_id as string),

    customerName: (quote.customer_name as string | null) ?? null,
    customerPhone: (quote.customer_phone as string | null) ?? null,
    customerEmail: (quote.customer_email as string | null) ?? null,

    currency: (quote.currency as string | null) || "USD",
    items: (items ?? []).map((it) => ({
      item_name: it.item_name as string,
      description: (it.description as string | null) ?? null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: Number(it.amount) || 0,
      group_label: (it.group_label as string | null) ?? null,
    })),
    subtotal: Number(quote.subtotal) || 0,
    taxRate: Number(quote.tax_rate) || 0,
    taxAmount: Number(quote.tax_amount) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    total: Number(quote.total) || 0,

    notes: (quote.notes as string | null) ?? null,
    terms: (quote.terms as string | null) ?? null,
    footerNote: (settings.footer_note as string | null) ?? null,
  };
}
