import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { DEAL_ACTIVE_STAGES, getDealCommercialValue, latestQuoteTotal } from "@/lib/sales/deals";
import type { DealRow, QuotationRow } from "@/types";

/** List deals for the signed-in salesperson (active pipeline by default). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "active"; // active | closed | all
  const ownerId = url.searchParams.get("ownerId");

  const supabase = createAdminClient();
  let query = supabase.from("deals").select("*").order("updated_at", { ascending: false });

  if (session.role === "SUPER_ADMIN") {
    // optional filter
  } else if (session.clientId) {
    query = query.eq("client_id", session.clientId);
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (canActAsSalesperson(session) && session.role !== "CLIENT_MANAGER") {
    query = query.eq("owner_id", session.userId);
  } else if (ownerId) {
    query = query.eq("owner_id", ownerId);
  } else if (canActAsSalesperson(session)) {
    query = query.eq("owner_id", session.userId);
  }

  if (scope === "active") {
    query = query.in("stage", [...DEAL_ACTIVE_STAGES]);
  } else if (scope === "closed") {
    query = query.in("stage", ["WON", "LOST"]);
  }

  const { data: deals, error } = await query.limit(500);
  if (error) {
    console.error("[GET /api/deals]", error);
    return NextResponse.json({ error: "Failed to load deals" }, { status: 500 });
  }

  const dealRows = (deals ?? []) as DealRow[];
  const dealIds = dealRows.map((d) => d.id);
  const leadIds = [...new Set(dealRows.map((d) => d.originating_lead_id))];

  const [{ data: quotes }, { data: leads }] = await Promise.all([
    dealIds.length
      ? supabase
          .from("quotations")
          .select("id, deal_id, lead_id, total, status, sent_at, created_at, updated_at")
          .in("deal_id", dealIds)
      : Promise.resolve({ data: [] as unknown[] }),
    leadIds.length
      ? supabase
          .from("leads")
          .select("id, name, phone, score, source, manual_priority")
          .in("id", leadIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const quotesByDeal = new Map<string, QuotationRow[]>();
  for (const q of (quotes ?? []) as QuotationRow[]) {
    if (!q.deal_id) continue;
    const list = quotesByDeal.get(q.deal_id) ?? [];
    list.push(q);
    quotesByDeal.set(q.deal_id, list);
  }

  const leadById = new Map(
    ((leads ?? []) as { id: string; name: string | null; phone: string | null; score: number | null; source: string; manual_priority: string | null }[]).map(
      (l) => [l.id, l]
    )
  );

  const items = dealRows.map((deal) => {
    const dealQuotes = quotesByDeal.get(deal.id) ?? [];
    const commercial = getDealCommercialValue(deal, {
      latestQuoteTotal: latestQuoteTotal(dealQuotes),
    });
    const lead = leadById.get(deal.originating_lead_id);
    return {
      deal,
      commercial,
      customerName: lead?.name ?? null,
      customerPhone: lead?.phone ?? null,
      leadScore: lead?.score ?? null,
      leadSource: lead?.source ?? null,
      leadPriority: lead?.manual_priority ?? null,
    };
  });

  return NextResponse.json({ deals: items });
}
