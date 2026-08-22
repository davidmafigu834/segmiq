import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PublicQuotationView, type PublicQuotationData } from "@/components/quotations/PublicQuotationView";
import { recordCustomerView } from "@/lib/quotations/engagement";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import { notifyQuotationAlert } from "@/lib/quotations/notify";
import type { QuotationLineItemInput } from "@/types";
import { buildQuoteDocumentModel } from "@/lib/quotations/layouts/build-document-model";
import { isSolarLayout } from "@/lib/quotations/layouts/registry";
import { getPublicBaseUrl } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[#09090b]">Quotation not found</h1>
        <p className="mt-3 text-sm text-[#52525b]">
          This link is invalid or has been removed. Please contact us for an up-to-date quotation.
        </p>
      </div>
    </div>
  );
}

export default async function PublicQuotePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("*")
    .eq("public_token", params.token)
    .maybeSingle();

  if (!quote) return <NotFound />;
  if (quote.link_revoked_at) return <NotFound />;

  const expired =
    !!quote.valid_until &&
    new Date(`${quote.valid_until as string}T23:59:59`) < new Date() &&
    quote.status !== "accepted" &&
    quote.status !== "rejected" &&
    quote.status !== "superseded";

  if (expired && quote.status !== "expired") {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string)
      .in("status", ["sent", "viewed"]);
    quote.status = "expired";
  }

  const session = await getServerSession(authOptions);
  const internal =
    Boolean(session?.userId) &&
    (session?.role === "SUPER_ADMIN" || session?.clientId === quote.client_id);

  if (!internal && (quote.status === "sent" || quote.status === "viewed")) {
    const result = await recordCustomerView(supabase, {
      quotationId: quote.id as string,
      clientId: quote.client_id as string,
      leadId: (quote.lead_id as string) ?? null,
      dealId: (quote.deal_id as string) ?? null,
      publicToken: params.token,
      currentStatus: quote.status as string,
      viewedAt: (quote.viewed_at as string | null) ?? null,
      lastViewedAt: (quote.last_viewed_at as string | null) ?? null,
      viewCount: Number(quote.view_count) || 0,
    });
    if (quote.status === "sent") quote.status = "viewed";
    if (result.firstView && quote.prepared_by_id) {
      await notifyQuotationAlert({
        userId: quote.prepared_by_id as string,
        leadId: quote.lead_id as string,
        quotationId: quote.id as string,
        message: `${quote.quote_number || "Quotation"} was viewed`,
      });
    }
  }

  let currentToken: string | null = null;
  if (quote.status === "superseded" && quote.superseded_by_id) {
    const { data: next } = await supabase
      .from("quotations")
      .select("public_token")
      .eq("id", quote.superseded_by_id as string)
      .maybeSingle();
    currentToken = (next?.public_token as string | null) ?? null;
  }

  const [{ data: items }, { data: client }, { data: settings }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select(
        "id, item_name, description, unit_price, quantity, amount, group_label, sort_order, is_optional, offer_option_id, discount_percent"
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
        "company_email, company_phone, company_address, footer_note, brand_footer, customer_allow_accept, customer_allow_request_changes, customer_allow_ask_question, customer_allow_decline, customer_allow_option_selection, require_acceptance_name, require_acceptance_checkbox"
      )
      .eq("client_id", quote.client_id as string)
      .maybeSingle(),
  ]);

  const lineInputs = (items ?? []).map((it) => ({
    item_name: it.item_name as string,
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 0,
    discount_percent: Number(it.discount_percent) || 0,
    is_optional: Boolean(it.is_optional),
  })) as QuotationLineItemInput[];
  const totals = computeQuotationTotals(lineInputs, {
    fallbackTaxRate: Number(quote.tax_rate) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
  });

  const documentModel = await buildQuoteDocumentModel(supabase, quote.id as string, {
    origin: getPublicBaseUrl(),
    preferUrls: true,
  }).catch(() => null);

  const data: PublicQuotationData = {
    token: params.token,
    status: expired ? "expired" : (quote.status as PublicQuotationData["status"]),
    quoteNumber: (quote.quote_number as string | null) ?? null,
    revisionNumber: Number(quote.revision_number) || 1,
    customerName: (quote.customer_name as string | null) ?? null,
    currency: (quote.currency as string | null) || "USD",
    validUntil: (quote.valid_until as string | null) ?? null,
    issuedAt: (quote.sent_at as string | null) ?? (quote.created_at as string | null),
    subtotal: totals.subtotal,
    taxRate: Number(quote.tax_rate) || 0,
    taxAmount: totals.taxAmount,
    otherAmount: Number(quote.other_amount) || 0,
    discountPercent: Number(quote.discount_percent) || 0,
    total: totals.total,
    notes: (quote.notes as string | null) ?? (quote.commercial_notes as string | null) ?? null,
    terms: (quote.terms_snapshot as string | null) ?? (quote.terms as string | null) ?? null,
    paymentTerms: (quote.payment_terms_label as string | null) ?? null,
    warrantyTerms: (quote.warranty_terms as string | null) ?? null,
    deliveryTerms: (quote.delivery_terms as string | null) ?? null,
    pdfUrl: (quote.pdf_url as string | null) ?? null,
    superseded: quote.status === "superseded",
    currentToken,
    items: (items ?? []).map((it) => ({
      id: it.id as string,
      item_name: it.item_name as string,
      description: (it.description as string | null) ?? null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: Number(it.amount) || 0,
      group_label: (it.group_label as string | null) ?? null,
      is_optional: Boolean(it.is_optional),
      offer_option_id: (it.offer_option_id as string | null) ?? null,
    })),
    offerOptions: Array.isArray(quote.offer_options) ? (quote.offer_options as PublicQuotationData["offerOptions"]) : [],
    customerActions: {
      accept: settings?.customer_allow_accept !== false,
      requestChanges: settings?.customer_allow_request_changes !== false,
      askQuestion: settings?.customer_allow_ask_question !== false,
      decline: settings?.customer_allow_decline !== false,
      optionSelection: settings?.customer_allow_option_selection !== false,
      requireName: Boolean(settings?.require_acceptance_name),
      requireCheckbox: settings?.require_acceptance_checkbox !== false,
    },
    brand: {
      companyName: (client?.name as string | null) || "Company",
      logoUrl: (client?.logo_url as string | null) ?? null,
      brandColor: (client?.primary_color as string | null) || "#0F7A4F",
      companyEmail: (settings?.company_email as string | null) ?? null,
      companyPhone: (settings?.company_phone as string | null) ?? null,
      companyAddress: (settings?.company_address as string | null) ?? null,
      footerNote: (settings?.brand_footer as string | null) ?? (settings?.footer_note as string | null) ?? null,
    },
    document: documentModel && isSolarLayout(documentModel.layoutKey) ? documentModel : null,
  };

  return <PublicQuotationView data={data} />;
}
