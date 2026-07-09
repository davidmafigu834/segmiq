import { createAdminClient } from "@/lib/supabase/admin";
import { PublicQuotationView, type PublicQuotationData } from "@/components/quotations/PublicQuotationView";

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

  const expired =
    !!quote.valid_until &&
    new Date(`${quote.valid_until as string}T23:59:59`) < new Date() &&
    quote.status !== "accepted" &&
    quote.status !== "rejected";

  if (expired && quote.status !== "expired") {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string);
    quote.status = "expired";
  }

  if (quote.status === "sent") {
    await supabase
      .from("quotations")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", quote.id as string)
      .eq("status", "sent");
    quote.status = "viewed";
  }

  const [{ data: items }, { data: client }, { data: settings }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select("item_name, description, unit_price, quantity, amount, group_label, sort_order")
      .eq("quotation_id", quote.id as string)
      .order("sort_order", { ascending: true }),
    supabase
      .from("clients")
      .select("name, logo_url, primary_color")
      .eq("id", quote.client_id as string)
      .maybeSingle(),
    supabase
      .from("quotation_settings")
      .select("company_email, company_phone, footer_note")
      .eq("client_id", quote.client_id as string)
      .maybeSingle(),
  ]);

  const data: PublicQuotationData = {
    token: params.token,
    status: expired ? "expired" : (quote.status as PublicQuotationData["status"]),
    quoteNumber: (quote.quote_number as string | null) ?? null,
    customerName: (quote.customer_name as string | null) ?? null,
    currency: (quote.currency as string | null) || "USD",
    validUntil: (quote.valid_until as string | null) ?? null,
    subtotal: Number(quote.subtotal) || 0,
    taxRate: Number(quote.tax_rate) || 0,
    taxAmount: Number(quote.tax_amount) || 0,
    otherAmount: Number(quote.other_amount) || 0,
    total: Number(quote.total) || 0,
    notes: (quote.notes as string | null) ?? null,
    terms: (quote.terms as string | null) ?? null,
    pdfUrl: (quote.pdf_url as string | null) ?? null,
    items: (items ?? []).map((it) => ({
      item_name: it.item_name as string,
      description: (it.description as string | null) ?? null,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      amount: Number(it.amount) || 0,
      group_label: (it.group_label as string | null) ?? null,
    })),
    brand: {
      companyName: (client?.name as string | null) || "Company",
      logoUrl: (client?.logo_url as string | null) ?? null,
      brandColor: (client?.primary_color as string | null) || "#0F7A4F",
      companyEmail: (settings?.company_email as string | null) ?? null,
      companyPhone: (settings?.company_phone as string | null) ?? null,
      footerNote: (settings?.footer_note as string | null) ?? null,
    },
  };

  return <PublicQuotationView data={data} />;
}
