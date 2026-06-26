"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";
import { CustomerHubDashboard, CustomerHubHeader } from "@/components/customer-hub/CustomerHubDashboard";
import { ClientContactsTable } from "@/components/client-contacts/ClientContactsTable";

export function CustomerHubContactsShell({
  clientId,
  assignmentMode,
  showDashboard,
  showLifecycleFilter,
  heading,
  subheading,
}: {
  clientId: string;
  assignmentMode: "direct" | "pool" | "round_robin";
  showDashboard: boolean;
  showLifecycleFilter?: boolean;
  heading: string;
  subheading: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("hubFilter");
  const [hubFilter, setHubFilter] = useState<string | null>(initialFilter);
  const [addOpen, setAddOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  useEffect(() => {
    setHubFilter(searchParams.get("hubFilter"));
  }, [searchParams]);

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      {showDashboard && (
        <>
          <CustomerHubHeader
            onOpenAdd={() => setAddOpen(true)}
            onOpenWalkIn={() => setWalkInOpen(true)}
          />
          <CustomerHubDashboard onFilterChange={setHubFilter} />
        </>
      )}

      <ClientContactsTable
        showLifecycleFilter={showLifecycleFilter}
        heading={heading}
        subheading={subheading}
        hubFilter={hubFilter}
        onClearHubFilter={() => setHubFilter(null)}
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
