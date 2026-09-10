import type { PublicQuotationData } from "@/components/quotations/PublicQuotationView";
import type { QuotationLineItemInput } from "@/types";
import { computeQuotationTotals } from "@/lib/quotations/totals";

export const PUBLIC_QUOTATION_FETCH_SELECT = [
  "id",
  "client_id",
  "lead_id",
  "deal_id",
  "quote_number",
  "revision_number",
  "status",
  "customer_name",
  "sent_at",
  "valid_until",
  "viewed_at",
  "last_viewed_at",
  "view_count",
  "created_at",
  "updated_at",
  "public_token",
  "prepared_by_id",
  "link_revoked_at",
  "superseded_by_id",
  "currency",
  "tax_rate",
  "other_amount",
  "discount_percent",
  "notes",
  "commercial_notes",
  "terms",
  "terms_snapshot",
  "payment_terms_label",
  "warranty_terms",
  "delivery_terms",
  "pdf_url",
  "offer_options",
].join(", ");

export const PUBLIC_QUOTATION_ACTION_SELECT = [
  "id",
  "client_id",
  "lead_id",
  "deal_id",
  "quote_number",
  "revision_number",
  "status",
  "customer_name",
  "customer_phone",
  "currency",
  "tax_rate",
  "other_amount",
  "discount_percent",
  "terms",
  "terms_snapshot",
  "prepared_by_id",
  "public_token",
  "link_revoked_at",
  "superseded_by_id",
  "valid_until",
  "viewed_at",
  "last_viewed_at",
  "view_count",
  "selected_offer_option_id",
  "customer_configuration",
].join(", ");

type PublicQuoteRow = Record<string, unknown>;

type PublicQuoteItemRow = {
  id?: string;
  item_name?: string;
  description?: string | null;
  unit_price?: number | string | null;
  quantity?: number | string | null;
  amount?: number | string | null;
  group_label?: string | null;
  is_optional?: boolean | null;
  offer_option_id?: string | null;
  discount_percent?: number | string | null;
};

type PublicQuoteBrand = {
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  footerNote: string | null;
  taxRegistration?: string | null;
  legalRegistration?: string | null;
  bankDetails?: string | null;
};

type PublicQuoteActions = NonNullable<PublicQuotationData["customerActions"]>;

export function buildPublicQuotationPayload(opts: {
  token: string;
  quote: PublicQuoteRow;
  items: PublicQuoteItemRow[];
  brand: PublicQuoteBrand;
  customerActions: PublicQuoteActions;
  currentToken?: string | null;
  document?: PublicQuotationData["document"];
}): PublicQuotationData {
  const lineInputs = opts.items.map((it) => ({
    item_name: it.item_name as string,
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 0,
    discount_percent: Number(it.discount_percent) || 0,
    is_optional: Boolean(it.is_optional),
  })) as QuotationLineItemInput[];

  const totals = computeQuotationTotals(lineInputs, {
    fallbackTaxRate: Number(opts.quote.tax_rate) || 0,
    otherAmount: Number(opts.quote.other_amount) || 0,
    discountPercent: Number(opts.quote.discount_percent) || 0,
  });

  return {
    token: opts.token,
    status: opts.quote.status as PublicQuotationData["status"],
    quoteNumber: (opts.quote.quote_number as string | null) ?? null,
    revisionNumber: Number(opts.quote.revision_number) || 1,
    customerName: (opts.quote.customer_name as string | null) ?? null,
    currency: (opts.quote.currency as string | null) || "USD",
    validUntil: (opts.quote.valid_until as string | null) ?? null,
    issuedAt: (opts.quote.sent_at as string | null) ?? (opts.quote.created_at as string | null),
    subtotal: totals.subtotal,
    taxRate: Number(opts.quote.tax_rate) || 0,
    taxAmount: totals.taxAmount,
    otherAmount: Number(opts.quote.other_amount) || 0,
    discountPercent: Number(opts.quote.discount_percent) || 0,
    total: totals.total,
    notes: (opts.quote.notes as string | null) ?? (opts.quote.commercial_notes as string | null) ?? null,
    terms: (opts.quote.terms_snapshot as string | null) ?? (opts.quote.terms as string | null) ?? null,
    paymentTerms: (opts.quote.payment_terms_label as string | null) ?? null,
    warrantyTerms: (opts.quote.warranty_terms as string | null) ?? null,
    deliveryTerms: (opts.quote.delivery_terms as string | null) ?? null,
    pdfUrl: (opts.quote.pdf_url as string | null) ?? null,
    superseded: opts.quote.status === "superseded",
    currentToken: opts.currentToken ?? null,
    items: opts.items.map((it) => ({
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
    offerOptions: Array.isArray(opts.quote.offer_options)
      ? (opts.quote.offer_options as PublicQuotationData["offerOptions"])
      : [],
    customerActions: opts.customerActions,
    brand: opts.brand,
    document: opts.document ?? null,
  };
}
