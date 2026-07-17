"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { CustomerHubPageHeader } from "@/components/customer-hub/CustomerHubPageHeader";
import { useCustomerHubActions } from "@/components/customer-hub/useCustomerHubActions";
import { ImportContactsModal } from "@/components/customer-hub/ImportContactsModal";
import { ClientContactsTable } from "@/components/client-contacts/ClientContactsTable";
import {
  CONTACT_LIFECYCLE_DESCRIPTIONS,
  CONTACT_LIFECYCLE_LABELS,
  isContactLifecycle,
} from "@/lib/customer-hub/lifecycle";

export function CustomerHubContactsShell({
  clientId,
  clientName,
  assignmentMode,
}: {
  clientId: string;
  clientName?: string;
  assignmentMode: "direct" | "pool" | "round_robin";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("hubFilter");
  const lifecycleParam =
    searchParams.get("lifecycle") ??
    (searchParams.get("relationship") === "cold" || searchParams.get("relationship") === "aware"
      ? searchParams.get("relationship")
      : null);
  const stageFilter = isContactLifecycle(lifecycleParam) ? lifecycleParam : null;
  const [hubFilter, setHubFilter] = useState<string | null>(initialFilter);
  const [importOpen, setImportOpen] = useState(false);
  const { sheets, openAdd, openWalkIn } = useCustomerHubActions(clientId, assignmentMode);

  useEffect(() => {
    setHubFilter(searchParams.get("hubFilter"));
  }, [searchParams]);

  function handleExport() {
    const params = new URLSearchParams();
    if (stageFilter) params.set("lifecycle", stageFilter);
    window.location.href = `/api/contacts/export?${params.toString()}`;
  }

  return (
    <>
      <CustomerHubPageHeader
        clientName={clientName}
        title={stageFilter ? `${CONTACT_LIFECYCLE_LABELS[stageFilter]} contacts` : "All contacts"}
        description={
          stageFilter
            ? CONTACT_LIFECYCLE_DESCRIPTIONS[stageFilter]
            : "Everyone in your relationship memory — every source, every stage."
        }
        onOpenAdd={openAdd}
        onOpenWalkIn={openWalkIn}
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[13px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
        >
          <Upload className="h-4 w-4" strokeWidth={1.5} />
          Import CSV
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-[13px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]"
        >
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Export segment
        </button>
      </div>

      <ClientContactsTable
        showLifecycleFilter
        hideHeading
        initialLifecycle={stageFilter}
        hubFilter={hubFilter}
        onClearHubFilter={() => {
          setHubFilter(null);
          router.push(stageFilter ? `/client/contacts?lifecycle=${stageFilter}` : "/client/contacts");
        }}
        onClearLifecycleFilter={() => router.push("/client/contacts")}
      />

      {importOpen && (
        <ImportContactsModal
          clientId={clientId}
          onClose={() => setImportOpen(false)}
          onSuccess={() => router.refresh()}
        />
      )}
      {sheets}
    </>
  );
}
