"use client";

import { CustomerHubPageHeader } from "@/components/customer-hub/CustomerHubPageHeader";
import { useCustomerHubActions } from "@/components/customer-hub/useCustomerHubActions";
import { ClientLeadsTable } from "@/components/client-leads/ClientLeadsTable";
import type { ClientLeadListRow } from "@/components/client-leads/client-leads-types";

export function CustomerHubPipelineShell({
  clientId,
  clientName,
  assignmentMode,
  initialLeads,
  salespeople,
  totalThisMonth,
  initialHasMore,
  totalCount,
}: {
  clientId: string;
  clientName: string;
  assignmentMode: "direct" | "pool" | "round_robin";
  initialLeads: ClientLeadListRow[];
  salespeople: { id: string; name: string }[];
  totalThisMonth: number;
  initialHasMore: boolean;
  totalCount: number;
}) {
  const { sheets, openAdd, openWalkIn } = useCustomerHubActions(clientId, assignmentMode);

  return (
    <>
      <CustomerHubPageHeader
        clientName={clientName}
        title="Pipeline"
        description="Active leads — assign, follow up, and move deals forward."
        onOpenAdd={openAdd}
        onOpenWalkIn={openWalkIn}
      />
      <ClientLeadsTable
        clientId={clientId}
        clientName={clientName}
        initialLeads={initialLeads}
        salespeople={salespeople}
        totalThisMonth={totalThisMonth}
        initialHasMore={initialHasMore}
        totalCount={totalCount}
        hideHeader
      />
      {sheets}
    </>
  );
}
