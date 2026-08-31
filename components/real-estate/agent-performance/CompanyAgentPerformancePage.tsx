"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Trophy, X } from "lucide-react";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { useMediaQuery } from "@/components/dashboard/company/team/CompanyTeamInviteDialog";
import { CompanyRePageFrame } from "@/components/real-estate/company/CompanyRePageFrame";
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
import type { AgentSupervisionRow } from "@/lib/real-estate/agent-supervision";
import type { CompanyPageChrome } from "@/lib/real-estate/company-page-chrome";
import { cn } from "@/lib/ui/cn";

export function CompanyAgentPerformancePage({
  chrome,
  agents,
}: {
  chrome: CompanyPageChrome;
  agents: AgentSupervisionRow[];
}) {
  const router = useRouter();
  const overlayPanel = useMediaQuery("(max-width: 1279px)");
  const stackedSplit = useMediaQuery("(max-width: 767px)");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totals = useMemo(
    () => ({
      agents: agents.length,
      inquiries: agents.reduce((n, a) => n + a.inquiries, 0),
      viewings: agents.reduce((n, a) => n + a.viewings, 0),
      offers: agents.reduce((n, a) => n + a.offers, 0),
      concluded: agents.reduce((n, a) => n + a.concluded, 0),
    }),
    [agents]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((row) => row.name.toLowerCase().includes(q));
  }, [agents, search]);

  const selected = agents.find((row) => row.id === selectedId) ?? null;

  const table = (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search agents…"
          className="min-w-0 w-full sm:w-[240px]"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Trophy className="h-4 w-4" strokeWidth={1.5} />}
            title={agents.length === 0 ? "No agents to measure yet" : "No agents match this search"}
            description={
              agents.length === 0
                ? "Invite agents from the Agents page. Live activity appears here."
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
                  <DataTableTh>Agent</DataTableTh>
                  <DataTableTh className="text-right">Enquiries</DataTableTh>
                  <DataTableTh className="text-right">Viewings</DataTableTh>
                  <DataTableTh className="text-right">Follow-ups due</DataTableTh>
                  <DataTableTh className="text-right">Offers</DataTableTh>
                  <DataTableTh className="text-right">Concluded</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => (
                  <DataTableRow
                    key={row.id}
                    selected={row.id === selectedId}
                    className="h-[56px] cursor-pointer"
                    onClick={() => setSelectedId(row.id)}
                  >
                    <DataTableTd className="font-semibold text-sales-text-primary">{row.name}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.inquiries}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.viewings}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.followUpsDue}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.offers}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.concluded}</DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>
          <div className="divide-y divide-sales-border-subtle md:hidden">
            {filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-left hover:bg-sales-surface-hover",
                  row.id === selectedId && "bg-sales-brand-soft"
                )}
                onClick={() => setSelectedId(row.id)}
              >
                <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
                <p className="mt-0.5 text-[11px] text-sales-text-muted">
                  {row.inquiries} inquiries · {row.viewings} viewings · {row.concluded} concluded
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
          aria-label="Close agent details"
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
            <p className="mt-0.5 text-[12px] text-sales-text-muted">Live activity</p>
          </div>
          <IconButton aria-label="Close agent details" onClick={() => setSelectedId(null)}>
            <X size={16} />
          </IconButton>
        </div>
        <dl className="grid grid-cols-2 gap-3 px-4 text-[13px] sm:px-5">
          {[
            ["Enquiries", selected.inquiries],
            ["Viewings", selected.viewings],
            ["Follow-ups due", selected.followUpsDue],
            ["Offers", selected.offers],
            ["Concluded", selected.concluded],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[11px] text-sales-text-muted">{label}</dt>
              <dd className="mt-1 font-semibold tabular-nums text-sales-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto border-t border-sales-border-subtle px-4 py-3 sm:px-5">
          <Button
            variant="primary"
            size="md"
            className="w-full"
            rightIcon={<ArrowUpRight size={15} />}
            onClick={() => router.push(`/client/team?member=${selected.id}`)}
          >
            Open agent
          </Button>
        </div>
      </aside>
    </>
  ) : null;

  return (
    <CompanyRePageFrame
      chrome={chrome}
      breadcrumb="Company / Agent Performance"
      title="Agent performance"
      description="Each agent’s enquiries, viewings, follow-ups, offers and concluded transactions."
      hideMobileChrome={stackedSplit && Boolean(selectedId)}
      primaryAction={
        <Button
          variant="primary"
          size="md"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/team")}
        >
          View agents
        </Button>
      }
      titleActions={
        <Button
          variant="primary"
          size="md"
          className="layout:hidden"
          rightIcon={<ArrowUpRight size={15} />}
          onClick={() => router.push("/client/team")}
        >
          View agents
        </Button>
      }
    >
      <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CompanyKpiCard item={{ id: "agents", label: "Agents", value: String(totals.agents), supporting: "Active", icon: "customers" }} />
        <CompanyKpiCard item={{ id: "inquiries", label: "Enquiries", value: String(totals.inquiries), supporting: "Assigned", icon: "enquiries" }} />
        <CompanyKpiCard item={{ id: "viewings", label: "Viewings", value: String(totals.viewings), supporting: "Across the team", icon: "followups" }} />
        <CompanyKpiCard item={{ id: "offers", label: "Offers", value: String(totals.offers), supporting: "In play", icon: "deals" }} />
        <CompanyKpiCard item={{ id: "concluded", label: "Concluded", value: String(totals.concluded), supporting: "Won / sold / let", icon: "won" }} />
      </div>

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
