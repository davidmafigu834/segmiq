import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { PipelinePageShell } from "@/components/sales/pipeline/PipelinePageShell";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { SalesBoard } from "./SalesBoard";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";
import {
  fetchLatestFollowUpLogsByLeadId,
  isActiveConvertLaterPick,
} from "@/lib/convert-later-picks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function PipelineSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading pipeline">
      <div className="flex gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-[#E4E7EC]/40" />
        <div className="ml-auto h-9 w-56 animate-pulse rounded-lg bg-[#E4E7EC]/40" />
      </div>
      <div className="grid grid-cols-1 gap-3 layout:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[16rem] rounded-[12px] border border-[#E4E7EC] bg-white p-3"
          >
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-[#F2F4F7]" />
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

export default async function SalesLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const supabase = createAdminClient();
  const [first, navBadges] = await Promise.all([
    supabase
      .from("leads")
      .select("*, clients ( response_time_limit_hours )")
      .eq("assigned_to_id", session.userId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", { ascending: false }),
    fetchSalesNavBadges(session.userId, session.clientId ?? null),
  ]);

  let leads = first.data;
  if (first.error && String(first.error.message || "").includes("column leads.is_archived does not exist")) {
    const retry = await supabase
      .from("leads")
      .select("*, clients ( response_time_limit_hours )")
      .eq("assigned_to_id", session.userId)
      .order("created_at", { ascending: false });
    leads = retry.data ?? [];
  }

  const leadRows = (leads ?? []) as LeadWithClientResponseLimit[];
  const pickLeadIds = leadRows.filter(isActiveConvertLaterPick).map((l) => l.id);
  const pickLogContext = await fetchLatestFollowUpLogsByLeadId(supabase, pickLeadIds);

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
          <SalesBoard
            initialLeads={leadRows}
            pickLogContext={pickLogContext}
            repName={session.user?.name ?? ""}
          />
        </Suspense>
      </PipelinePageShell>
    </SalesLayout>
  );
}
