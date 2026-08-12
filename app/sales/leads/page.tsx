import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { PipelinePageShell } from "@/components/sales/pipeline/PipelinePageShell";
import { DealsBoard, type DealBoardItem } from "@/components/sales/pipeline/DealsBoard";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import {
  getDealCommercialValue,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import type { DealRow, QuotationRow } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function PipelineSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading pipeline">
      <div className="flex gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-sales-border/40" />
        <div className="ml-auto h-9 w-56 animate-pulse rounded-lg bg-sales-border/40" />
      </div>
      <div className="grid grid-cols-1 gap-3 layout:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[16rem] rounded-[12px] border border-sales-border bg-sales-surface p-3"
          >
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--sales-neutral-100)]" />
            <div className="space-y-2">
              <div className="h-28 animate-pulse rounded-[12px] bg-[#F8F9FB]" />
              <div className="h-28 animate-pulse rounded-[12px] bg-[#F8F9FB]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function SalesPipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const supabase = createAdminClient();
  const [dealsRes, navBadges] = await Promise.all([
    supabase
      .from("deals")
      .select("*")
      .eq("owner_id", session.userId)
      .order("updated_at", { ascending: false }),
    fetchSalesNavBadges(session.userId, session.clientId ?? null),
  ]);

  const dealRows = (dealsRes.data ?? []) as DealRow[];
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
    (
      (leads ?? []) as {
        id: string;
        name: string | null;
        phone: string | null;
        score: number | null;
        source: string;
        manual_priority: string | null;
      }[]
    ).map((l) => [l.id, l])
  );

  const boardItems: DealBoardItem[] = dealRows.map((deal) => {
    const dealQuotes = quotesByDeal.get(deal.id) ?? [];
    const lead = leadById.get(deal.originating_lead_id);
    return {
      deal,
      commercial: getDealCommercialValue(deal, {
        latestQuoteTotal: latestQuoteTotal(dealQuotes),
      }),
      customerName: lead?.name ?? null,
      customerPhone: lead?.phone ?? null,
      leadScore: lead?.score ?? null,
      leadSource: lead?.source ?? null,
    };
  });

  let unread = 0;
  let avatarUrl: string | null = null;
  try {
    const [unreadRes, userRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false),
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    ]);
    unread = unreadRes.count ?? 0;
    avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
  } catch {
    unread = 0;
  }

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);
  const tasksBadge = navBadges.followUpsToday || navBadges.callNow || 0;

  return (
    <SalesLayout
      breadcrumb="SALES / PIPELINE"
      pageTitle="My pipeline"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <PipelinePageShell
        userName={session.user?.name ?? "Sales"}
        avatarUrl={avatarUrl}
        unreadNotifications={unread}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
        tasksBadge={tasksBadge}
        isSolo={session.clientMode === "solo"}
      >
        <Suspense fallback={<PipelineSkeleton />}>
          <DealsBoard initialItems={boardItems} />
        </Suspense>
      </PipelinePageShell>
    </SalesLayout>
  );
}
