"use client";

import { Download } from "lucide-react";
import { CustomerHubPageHeader } from "@/components/customer-hub/CustomerHubPageHeader";
import { useCustomerHubActions } from "@/components/customer-hub/useCustomerHubActions";
import { ClientContactsTable } from "@/components/client-contacts/ClientContactsTable";

export function CustomerHubCustomersShell({
  clientId,
  clientName,
  assignmentMode,
}: {
  clientId: string;
  clientName?: string;
  assignmentMode: "direct" | "pool" | "round_robin";
}) {
  const { sheets, openAdd, openWalkIn } = useCustomerHubActions(clientId, assignmentMode);

  return (
    <>
      <CustomerHubPageHeader
        clientName={clientName}
        title="Customers"
        description="People you've won — your repeat and referral base."
        onOpenAdd={openAdd}
        onOpenWalkIn={openWalkIn}
      />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            window.location.href = "/api/contacts/export?lifecycle=customer";
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[13px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
        >
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Export customers
        </button>
      </div>
      <ClientContactsTable defaultLifecycle="customer" hideHeading compactCards />
      {sheets}
    </>
  );
}
