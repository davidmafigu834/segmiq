import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SoloLayout } from "@/components/layouts/SoloLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { DealWorkspaceClient } from "@/components/sales/deals/DealWorkspaceClient";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";
import {
  getDealCommercialValue,
  getDealCompleteness,
  getDealNextActionState,
  getDealTimeline,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import type { DealRow, LeadRow, QuotationRow } from "@/types";
import { isRealEstate } from "@/lib/terminology";
import { companyOwners } from "@/lib/work-projects/page-data";
import { findWorkProjectIdForDeal } from "@/lib/work-projects/service";

export const dynamic = "force-dynamic";

export default async function DealWorkspacePage({
  params,
  searchParams,
}: {
  params: { dealId: string };
  searchParams?: { close?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const supabase = createAdminClient();
  const { lookupDemoDeal } = await import("@/lib/demo/acl");
  const demoDeal = await lookupDemoDeal(session.clientId, params.dealId);
  const { data: deal } = demoDeal.mode === "demo"
    ? { data: demoDeal.row }
    : await supabase.from("deals").select("*").eq("id", params.dealId).maybeSingle();

  if (!deal) notFound();
  const dealRow = deal as DealRow;

  if (session.role !== "SUPER_ADMIN" && dealRow.owner_id !== session.userId) {
    if (session.role !== "CLIENT_MANAGER" || session.clientId !== dealRow.client_id) {
      notFound();
    }
  }

  const demoBundle = demoDeal.mode === "demo" && demoDeal.dataset
    ? (await import("@/lib/demo/adapters/records")).demoDealPayload(demoDeal.dataset, dealRow)
    : null;
  const [{ data: lead }, { data: quotes }, timeline, shell] = demoBundle
    ? [
        { data: demoBundle.lead },
        { data: demoBundle.quotes },
        demoBundle.timeline,
        await loadSalesShellProps(session),
      ] as const
    : await Promise.all([
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
    loadSalesShellProps(session),
  ]);

  const { data: company } =
    demoDeal.mode === "demo"
      ? { data: null }
      : await supabase.from("clients").select("business_type").eq("id", dealRow.client_id).maybeSingle();
  const tradesDelivery =
    demoDeal.mode !== "demo" &&
    !isRealEstate((company as { business_type?: string | null } | null)?.business_type);
  const [existingWorkProjectId, projectOwners] = tradesDelivery
    ? await Promise.all([
        findWorkProjectIdForDeal(dealRow.client_id, dealRow.id),
        companyOwners(dealRow.client_id),
      ])
    : [null, [] as Array<{ id: string; name: string | null }>];

  const quoteRows = (quotes ?? []) as QuotationRow[];
  const quoteTotal = latestQuoteTotal(quoteRows);
  const commercial = getDealCommercialValue(dealRow, { latestQuoteTotal: quoteTotal });
  const completeness = getDealCompleteness(dealRow, { latestQuoteTotal: quoteTotal });
  const nextAction = getDealNextActionState(dealRow);
  const leadRow = (lead as LeadRow) ?? null;
  const customerName = leadRow?.name?.trim() || "Customer";

  const Layout = session.clientMode === "solo" ? SoloLayout : SalesLayout;

  return (
    <Layout
      breadcrumb="Sales / DEAL"
      pageTitle={dealRow.name}
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Deal"
        title={dealRow.name}
        description={`${customerName} · Keep this opportunity moving until a decision is made.`}
        searchPlaceholder="Search leads, deals, quotes..."
        dense
      >
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
          tradesDelivery={tradesDelivery}
          projectBasePath="/sales/projects"
          existingWorkProjectId={existingWorkProjectId}
          projectOwners={projectOwners}
        />
      </SalesAppShell>
    </Layout>
  );
}
