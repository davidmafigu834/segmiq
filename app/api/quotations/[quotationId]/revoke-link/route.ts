import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { logQuotationEvent } from "@/lib/quotations/events";

/** Manager/admin revokes the customer secure link for this quotation version. */
export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }
  if (access.actor.role === "SALESPERSON") {
    return NextResponse.json({ error: "Only managers can revoke a secure quotation link" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: quote } = await supabase
    .from("quotations")
    .select("id, public_token, deal_id, link_revoked_at")
    .eq("id", params.quotationId)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!quote.public_token) {
    return NextResponse.json({ error: "This quotation has no secure customer link" }, { status: 400 });
  }

  await supabase
    .from("quotations")
    .update({ link_revoked_at: now, updated_at: now })
    .eq("id", params.quotationId);

  await logQuotationEvent(supabase, {
    quotationId: params.quotationId,
    clientId: access.clientId,
    leadId: access.leadId,
    dealId: (quote.deal_id as string) || null,
    actor: { id: access.actor.id, name: access.actor.name },
    eventType: "LINK_REVOKED",
    eventData: {},
  });

  return NextResponse.json({ ok: true, revokedAt: now });
}
