"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Globe, X } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import {
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  IconButton,
  SearchInput,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export type WebsiteLeadRow = {
  leadId: string;
  name: string;
  sourceLabel: string;
  propertyLabel: string | null;
  agentName: string | null;
  createdAt: string;
  qualified: boolean;
  stageLabel: string | null;
};

export function CompanyWebsiteLeadsPage({
  chrome,
  clientId,
  month,
  latest,
}: {
  chrome: CompanyPageChrome;
  clientId: string;
  month: { inquiries: number; qualified: number; viewings: number; offers: number; accepted: number };
  latest: WebsiteLeadRow[];
}) {
  const router = useRouter();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return latest;
    return latest.filter((row) =>
      [row.name, row.propertyLabel, row.sourceLabel, row.agentName, row.stageLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [latest, search]);

  const selected = latest.find((row) => row.leadId === selectedId) ?? null;

  const table = (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search inquiries…"
          className="min-w-0 w-full sm:w-[240px]"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Globe className="h-4 w-4" strokeWidth={1.5} />}
            title={latest.length === 0 ? "No website inquiries received yet" : "No inquiries match this search"}
            description={
              latest.length === 0
                ? "When the estate website posts to SegmiQ, those inquiries will list here with source, property and agent."
                : "Try a different search."
            }
            size="compact"
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto md:block">
            <DataTableEl className="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Inquiry</DataTableTh>
                  <DataTableTh>Property</DataTableTh>
                  <DataTableTh>Agent</DataTableTh>
                  <DataTableTh>Stage</DataTableTh>
                  <DataTableTh className="text-right">Received</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow
                    key={row.leadId}
                    selected={row.leadId === selectedId}
                    className="h-[56px] cursor-pointer"
                    onClick={() => setSelectedId(row.leadId)}
                  >
                    <DataTableTd>
                      <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
                      <p className="truncate text-[11px] text-sales-text-muted">{row.sourceLabel}</p>
                    </DataTableTd>
                    <DataTableTd className="text-[12px] text-sales-text-secondary">
                      {row.propertyLabel ?? "—"}
                    </DataTableTd>
                    <DataTableTd className="text-[12px] text-sales-text-secondary">{row.agentName ?? "—"}</DataTableTd>
                    <DataTableTd className="text-[12px] text-sales-text-secondary">
                      {row.stageLabel ?? (row.qualified ? "Qualified" : "Open")}
                    </DataTableTd>
                    <DataTableTd className="text-right text-[11px] text-sales-text-muted">
                      {formatDistanceToNowStrict(new Date(row.createdAt), { addSuffix: true })}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>
          <div className="divide-y divide-sales-border-subtle md:hidden">
            {filtered.map((row) => (
              <button
                key={row.leadId}
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-left hover:bg-sales-surface-hover",
                  row.leadId === selectedId && "bg-sales-brand-soft"
                )}
                onClick={() => setSelectedId(row.leadId)}
              >
                <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-sales-text-muted">
                  {row.propertyLabel ?? "No property"}
                  {" · "}
                  {row.agentName ?? "Unassigned"}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const panel = selected ? (
    <>
      {overlayPanel ? (
        <button
          type="button"
          aria-label="Close inquiry details"
          className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
          onClick={() => setSelectedId(null)}
        />
      ) : null}
      <aside
        className={cn(
          "flex h-full min-h-[660px] flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card",
          overlayPanel &&
            "fixed inset-y-0 right-0 z-[70] w-full max-w-[410px] rounded-none border-y-0 border-r-0 sm:rounded-l-[14px] sm:border-y sm:border-r",
          stackedSplit && overlayPanel && "inset-0 max-w-none rounded-none"
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-sales-text-primary">
              {selected.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-sales-text-muted">{selected.sourceLabel}</p>
          </div>
          <IconButton aria-label="Close inquiry details" onClick={() => setSelectedId(null)}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-[13px] sm:px-5">
          <div>
            <p className="text-[11px] text-sales-text-muted">Property</p>
            <p className="mt-1 text-sales-text-primary">{selected.propertyLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-sales-text-muted">Agent</p>
            <p className="mt-1 text-sales-text-primary">{selected.agentName ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-[11px] text-sales-text-muted">Stage</p>
            <p className="mt-1 text-sales-text-primary">
              {selected.stageLabel ?? (selected.qualified ? "Qualified" : "Open")}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-sales-text-muted">Received</p>
            <p className="mt-1 text-sales-text-primary">
              {formatDistanceToNowStrict(new Date(selected.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="border-t border-sales-border-subtle px-4 py-3 sm:px-5">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            rightIcon={<ArrowUpRight size={15} />}
            onClick={() => router.push(`/client/leads?lead=${selected.leadId}`)}
          >
            Open inquiry
          </Button>
        </div>
      </aside>
    </>
  ) : null;

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Website Leads"
      title="Website leads"
      description="Inquiries received through the agency website integration, connected to qualification, viewings and offers."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={
        <Button
          variant="primary"
          size="md"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/leads")}
        >
          View inquiries
        </Button>
      }
      titleActions={
        <Button
          variant="primary"
          size="md"
          className="layout:hidden"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/leads")}
        >
          View inquiries
        </Button>
      }
    >
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CompanyKpiCard item={{ id: "inquiries", label: "Website inquiries", value: String(month.inquiries), supporting: "This month", icon: "enquiries" }} />
        <CompanyKpiCard item={{ id: "qualified", label: "Qualified", value: String(month.qualified), supporting: "This month", icon: "customers" }} />
        <CompanyKpiCard item={{ id: "viewings", label: "Viewings", value: String(month.viewings), supporting: "This month", icon: "followups" }} />
        <CompanyKpiCard item={{ id: "offers", label: "Offers", value: String(month.offers), supporting: "This month", icon: "deals" }} />
        <CompanyKpiCard item={{ id: "accepted", label: "Accepted offers", value: String(month.accepted), supporting: "This month", icon: "won" }} />
      </div>

      <WebsiteIntegrationPanel clientId={clientId} />

      {selectedId && !overlayPanel ? (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,30%)]">
          {table}
          <div className="min-h-0 xl:sticky xl:top-0">{panel}</div>
        </div>
      ) : (
        table
      )}
      {selectedId && overlayPanel ? panel : null}
    </CompanyRePageFrame>
  );
}
