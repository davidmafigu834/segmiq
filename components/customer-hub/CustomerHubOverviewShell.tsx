"use client";

import { useRouter } from "next/navigation";
import { CustomerHubDashboard } from "@/components/customer-hub/CustomerHubDashboard";
import { CustomerHubPageHeader } from "@/components/customer-hub/CustomerHubPageHeader";
import { useCustomerHubActions } from "@/components/customer-hub/useCustomerHubActions";

export function CustomerHubOverviewShell({
  clientId,
  clientName,
  assignmentMode,
}: {
  clientId: string;
  clientName: string;
  assignmentMode: "direct" | "pool" | "round_robin";
}) {
  const router = useRouter();
  const { sheets, openAdd, openWalkIn } = useCustomerHubActions(clientId, assignmentMode);

  function handleObservationFilter(filterKey: string | null) {
    if (filterKey) {
      router.push(`/client/contacts?hubFilter=${encodeURIComponent(filterKey)}`);
    }
  }

  return (
    <>
      <CustomerHubPageHeader
        clientName={clientName}
        title="Overview"
        description="Your company relationship memory — sources, stages, and what needs attention."
        onOpenAdd={openAdd}
        onOpenWalkIn={openWalkIn}
      />
      <CustomerHubDashboard onFilterChange={handleObservationFilter} />
      {sheets}
    </>
  );
}
