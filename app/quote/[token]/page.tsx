import { createAdminClient } from "@/lib/supabase/admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PublicQuotationView, type PublicQuotationData } from "@/components/quotations/PublicQuotationView";
import { recordCustomerView } from "@/lib/quotations/engagement";
import { notifyQuotationAlert } from "@/lib/quotations/notify";
import { buildQuoteDocumentModel } from "@/lib/quotations/layouts/build-document-model";
import { isSolarLayout } from "@/lib/quotations/layouts/registry";
import { getPublicBaseUrl } from "@/lib/constants";
import { buildPublicQuotationPayload, PUBLIC_QUOTATION_FETCH_SELECT } from "@/lib/quotations/public-payload";

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
    .select(PUBLIC_QUOTATION_FETCH_SELECT)
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

  const documentModel = await buildQuoteDocumentModel(supabase, quote.id as string, {
    origin: getPublicBaseUrl(),
    preferUrls: true,
  }).catch(() => null);

  const data: PublicQuotationData = buildPublicQuotationPayload({
    token: params.token,
    quote: {
      ...(quote as Record<string, unknown>),
      status: expired ? "expired" : quote.status,
    },
    items: (items ?? []) as Array<Record<string, unknown>>,
    brand: {
      companyName: (client?.name as string | null) || "Company",
      logoUrl: (client?.logo_url as string | null) ?? null,
      brandColor: (client?.primary_color as string | null) || "#0F7A4F",
      companyEmail: (settings?.company_email as string | null) ?? null,
      companyPhone: (settings?.company_phone as string | null) ?? null,
      companyAddress: (settings?.company_address as string | null) ?? null,
      footerNote: (settings?.brand_footer as string | null) ?? (settings?.footer_note as string | null) ?? null,
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
    currentToken,
    document: documentModel && isSolarLayout(documentModel.layoutKey) ? documentModel : null,
  });

  return <PublicQuotationView data={data} />;
}
