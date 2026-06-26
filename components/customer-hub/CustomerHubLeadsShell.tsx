"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { CustomerHubDashboard, CustomerHubHeader } from "@/components/customer-hub/CustomerHubDashboard";
import { ClientLeadsTable } from "@/components/client-leads/ClientLeadsTable";
import type { ClientLeadListRow } from "@/components/client-leads/client-leads-types";

export function CustomerHubLeadsShell({
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
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  function handleObservationFilter(filterKey: string | null) {
    if (filterKey) {
      router.push(`/client/contacts?hubFilter=${encodeURIComponent(filterKey)}`);
    }
  }

  return (
    <>
      <CustomerHubHeader
        clientName={clientName}
        onOpenAdd={() => setAddOpen(true)}
        onOpenWalkIn={() => setWalkInOpen(true)}
      />
      <CustomerHubDashboard onFilterChange={handleObservationFilter} />

      <ClientLeadsTable
        clientId={clientId}
        clientName={clientName}
        initialLeads={initialLeads}
        salespeople={salespeople}
        totalThisMonth={totalThisMonth}
        initialHasMore={initialHasMore}
        totalCount={totalCount}
      />

      {addOpen && (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="manager"
          clientId={clientId}
          onClose={() => setAddOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      {walkInOpen && (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="manager"
          clientId={clientId}
          defaultSource="Walk-in"
          hideSourceField
          variant="walk_in"
          onClose={() => setWalkInOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
