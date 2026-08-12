import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { DealWorkspaceClient } from "@/components/sales/deals/DealWorkspaceClient";
import {
  getDealCommercialValue,
  getDealCompleteness,
  getDealNextActionState,
  getDealTimeline,
  latestQuoteTotal,
} from "@/lib/sales/deals";
import type { DealRow, LeadRow, QuotationRow } from "@/types";

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
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", params.dealId)
    .maybeSingle();

  if (!deal) notFound();
  const dealRow = deal as DealRow;

  if (session.role !== "SUPER_ADMIN" && dealRow.owner_id !== session.userId) {
    if (session.role !== "CLIENT_MANAGER" || session.clientId !== dealRow.client_id) {
      notFound();
    }
  }

  const [{ data: lead }, { data: quotes }, timeline] = await Promise.all([
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
  ]);

  const quoteRows = (quotes ?? []) as QuotationRow[];
  const quoteTotal = latestQuoteTotal(quoteRows);
  const commercial = getDealCommercialValue(dealRow, { latestQuoteTotal: quoteTotal });
  const completeness = getDealCompleteness(dealRow, { latestQuoteTotal: quoteTotal });
  const nextAction = getDealNextActionState(dealRow);

  return (
    <SalesLayout
      breadcrumb="SALES / DEAL"
      pageTitle={dealRow.name}
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <DealWorkspaceClient
        initialDeal={dealRow}
        lead={(lead as LeadRow) ?? null}
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
      />
    </SalesLayout>
  );
}
