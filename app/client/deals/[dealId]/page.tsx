import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { DealWorkspaceClient } from "@/components/sales/deals/DealWorkspaceClient";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import {
  getDealCommercialValue,
  getDealCompleteness,
  getDealNextActionState,
  getDealTimeline,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import type { DealRow, LeadRow, QuotationRow } from "@/types";

export const dynamic = "force-dynamic";

export default async function CompanyDealWorkspacePage({
  params,
  searchParams,
}: {
  params: { dealId: string };
  searchParams?: { close?: string; clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const role = session.role;
  if (role !== "CLIENT_MANAGER" && role !== "SUPER_ADMIN") {
    redirect(`/sales/deals/${params.dealId}`);
  }

  const clientId =
    role === "SUPER_ADMIN"
      ? searchParams?.clientId || session.clientId
      : session.clientId;
  if (!clientId) redirect("/login");

  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", params.dealId)
    .maybeSingle();

  if (!deal) notFound();
  const dealRow = deal as DealRow;
  if (role === "CLIENT_MANAGER" && dealRow.client_id !== clientId) notFound();
  if (role === "SUPER_ADMIN" && searchParams?.clientId && dealRow.client_id !== searchParams.clientId) {
    notFound();
  }

  const [{ data: lead }, { data: quotes }, timeline, unreadRes, userRes, clientRes, navBadges] =
    await Promise.all([
      supabase.from("leads").select("*").eq("id", dealRow.originating_lead_id).maybeSingle(),
      supabase
        .from("quotations")
        .select("*")
        .or(
          `deal_id.eq.${dealRow.id},and(lead_id.eq.${dealRow.originating_lead_id},deal_id.is.null)`
        )
        .order("created_at", { ascending: false }),
      getDealTimeline({
        dealId: dealRow.id,
        originatingLeadId: dealRow.originating_lead_id,
      }),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false),
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
      supabase.from("clients").select("name, logo_url").eq("id", dealRow.client_id).maybeSingle(),
      fetchSalesNavBadges(session.userId, dealRow.client_id),
    ]);

  const quoteRows = (quotes ?? []) as QuotationRow[];
  const quoteTotal = latestQuoteTotal(quoteRows);
  const commercial = getDealCommercialValue(dealRow, { latestQuoteTotal: quoteTotal });
  const completeness = getDealCompleteness(dealRow, { latestQuoteTotal: quoteTotal });
  const nextAction = getDealNextActionState(dealRow);
  const leadRow = (lead as LeadRow) ?? null;
  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="DEAL"
      pageTitle={dealRow.name}
      hideShellHeader
      hideShellSidebar
      navClientId={dealRow.client_id}
    >
      <CompanyWorkspaceShell
        companyName={(clientRes.data as { name?: string } | null)?.name ?? "Company"}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
      >
        <CompanyDashboardHeader
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
          userName={session.user?.name ?? "User"}
          avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          canAddLead
          breadcrumb="Company / Pipeline / Deal"
          title={dealRow.name}
          description={`${leadRow?.name?.trim() || "Customer"} · Full Deal workspace.`}
        />
        <DealWorkspaceClient
          initialDeal={dealRow}
          lead={leadRow}
          quotes={quoteRows}
          commercial={commercial}
          completeness={completeness}
          nextAction={nextAction}
          timeline={timeline}
          openClose={
            searchParams?.close === "won"
              ? "won"
              : searchParams?.close === "lost"
                ? "lost"
                : null
          }
          repName={session.user?.name ?? ""}
          backHref="/client/leads/pipeline"
          backLabel="Back to Pipeline"
          quoteHrefMode="company"
          canCreateQuote={canActAsSalesperson(session)}
        />
      </CompanyWorkspaceShell>
    </ClientManagerLayout>
  );
}
