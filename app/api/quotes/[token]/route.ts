import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logStatusChanged } from "@/lib/lead-events";
import { proposalDealValueUpdate } from "@/lib/deal-value";

export const dynamic = "force-dynamic";

const VIEW_FROM = new Set(["sent"]);
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
  if (quote.status === "accepted" || quote.status === "rejected") return false;
  return new Date(`${quote.valid_until as string}T23:59:59`) < new Date();
}

/** Public quotation fetch — marks as viewed on first open. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const { supabase, quote } = await loadByToken(params.token);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isExpired(quote) && quote.status !== "accepted" && quote.status !== "rejected") {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string);
    quote.status = "expired";
  }

  if (VIEW_FROM.has(quote.status as string)) {
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

  return NextResponse.json({
    quotation: {
      ...quote,
      items: items ?? [],
      brand: {
        companyName: (client?.name as string | null) || "Company",
        logoUrl: (client?.logo_url as string | null) ?? null,
        brandColor: (client?.primary_color as string | null) || "#0F7A4F",
        companyEmail: (settings?.company_email as string | null) ?? null,
        companyPhone: (settings?.company_phone as string | null) ?? null,
        footerNote: (settings?.footer_note as string | null) ?? null,
      },
    },
  });
}

/** Public accept / reject from the customer link. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const { supabase, quote } = await loadByToken(params.token);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action === "accept" ? "accept" : body.action === "reject" ? "reject" : null;
  if (!action) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const status = quote.status as string;
  if (status === "accepted" || status === "rejected") {
    return NextResponse.json({ error: "This quotation has already been responded to" }, { status: 409 });
  }
  if (!RESPONDABLE.has(status)) {
    return NextResponse.json({ error: "This quotation cannot be responded to" }, { status: 409 });
  }
  if (isExpired(quote)) {
    await supabase
      .from("quotations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", quote.id as string);
    return NextResponse.json({ error: "This quotation has expired" }, { status: 410 });
  }

  const respondedAt = new Date().toISOString();
  const newStatus = action === "accept" ? "accepted" : "rejected";
  const updates: Record<string, unknown> = {
    status: newStatus,
    responded_at: respondedAt,
    updated_at: respondedAt,
  };
  if (newStatus === "accepted") updates.accepted_at = respondedAt;

  await supabase.from("quotations").update(updates).eq("id", quote.id as string);

  if (newStatus === "accepted") {
    const proposalValue = proposalDealValueUpdate(Number(quote.total) || 0);
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
  }

  return NextResponse.json({ success: true, status: newStatus });
}
