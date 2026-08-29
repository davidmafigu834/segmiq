"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { RealEstateInquiryWorkspace } from "@/components/real-estate/RealEstateInquiryWorkspace";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { KpiCard } from "@/components/dashboard/sales/KpiCard";
import { CardShell } from "@/components/dashboard/sales/KpiCard";
import { Avatar, Badge, EmptyState, SegmentedControl } from "@/components/sales/ui";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  RE_BOARD_COLUMNS,
  reBoardColumnForStage,
  rePipelineStageLabel,
  type ReBoardColumnId,
} from "@/lib/real-estate/pipeline";
import type { RealEstatePipelineData } from "@/lib/sales/get-real-estate-pipeline-data";
import type { UserRole } from "@/types";
import { cn } from "@/lib/ui/cn";

type BoardItem = RealEstatePipelineData["columns"][number]["items"][number];
type Tab = "active" | "closed";
type ViewMode = "board" | "attention";

function followUpTone(iso: string | null): { label: string; danger: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (due.getTime() < start.getTime()) return { label: "Overdue", danger: true };
  if (due.getTime() < end.getTime()) return { label: "Due today", danger: false };
  return null;
}

function InquiryCard({
  item,
  showOwner,
  selected,
  onOpen,
}: {
  item: BoardItem;
  showOwner: boolean;
  selected?: boolean;
  onOpen: (id: string) => void;
}) {
  const due = followUpTone(item.followUpAt);
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={cn(
        "w-full rounded-[12px] border bg-sales-surface px-3 py-2.5 text-left shadow-sales-card transition-[border-color,box-shadow] duration-150",
        selected
          ? "border-sales-brand-border bg-sales-brand-soft"
          : "border-sales-border hover:border-sales-border-strong hover:shadow-sales-card-hover"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={item.name} size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-sales-text-primary">
              {item.name}
            </p>
            {due ? (
              <Badge tone={due.danger ? "danger" : "warning"} appearance="soft" className="shrink-0">
                {due.label}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <DealSideBadge dealSide={item.dealSide} />
            <span className="truncate text-[11px] text-sales-text-muted">
              {rePipelineStageLabel(item.stage)}
            </span>
          </div>
          {item.phone ? (
            <p className="mt-0.5 truncate font-mono text-[11px] text-sales-text-muted">{item.phone}</p>
          ) : null}
          {item.complianceLabel ? (
            <p className="mt-1 truncate text-[11px] text-sales-text-secondary">{item.complianceLabel}</p>
          ) : null}
          {showOwner ? (
            <p className="mt-1 truncate text-[11px] text-sales-text-muted">
              {item.ownerName ?? "Unassigned"}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function RealEstatePipelineBoard({
  data,
  clientId,
  clientName,
  companyLogoUrl,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  whatsappBadge = 0,
  inquiryBaseHref = "/client/leads",
  embedded = false,
}: {
  data: RealEstatePipelineData;
  clientId: string;
  clientName: string;
  companyLogoUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  whatsappBadge?: number;
  inquiryBaseHref?: string;
  embedded?: boolean;
}) {
  const isNarrow = useMediaQuery("(max-width: 1199px)");
  const [tab, setTab] = useState<Tab>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [mobileCol, setMobileCol] = useState<ReBoardColumnId>("new");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (item: BoardItem): boolean => {
      if (!q) return true;
      return [item.name, item.phone, item.ownerName, item.complianceLabel, rePipelineStageLabel(item.stage)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    },
    [q]
  );

  const byGroup = useMemo(() => {
    const next: Record<ReBoardColumnId, BoardItem[]> = {
      new: [],
      qualified: [],
      viewing: [],
      interested: [],
      offer: [],
    };
    for (const col of data.columns) {
      for (const item of col.items) {
        if (!matches(item)) continue;
        const group = reBoardColumnForStage(item.stage);
        if (group) next[group].push(item);
      }
    }
    return next;
  }, [data.columns, matches]);

  const closedItems = useMemo(
    () => data.closed.flatMap((c) => c.items.filter(matches)),
    [data.closed, matches]
  );

  const activeCount = data.columns.reduce((s, c) => s + c.count, 0);
  const followUps = data.workload.reduce((s, w) => s + w.followUpsDue, 0);
  const viewings = data.workload.reduce((s, w) => s + w.viewingsThisWeek, 0);

  function openInquiry(id: string) {
    setOpenLeadId(id);
  }

  const kpis = (
    <div className="dashboard-group relative z-[1] grid w-full grid-cols-2 gap-3 min-[900px]:grid-cols-4">
      <KpiCard
        item={{
          id: "inquiries",
          label: embedded ? "My inquiries" : "Active inquiries",
          value: String(activeCount),
          supporting: "Open pipeline",
          icon: "enquiries",
        }}
      />
      <KpiCard
        item={{
          id: "followups",
          label: "Follow-ups due",
          value: String(followUps),
          supporting: embedded ? "Your book" : "Across agents",
          icon: "followups",
        }}
      />
      <KpiCard
        item={{
          id: "viewings",
          label: "Viewings this week",
          value: String(viewings),
          supporting: "Scheduled",
          icon: "customers",
        }}
      />
      <KpiCard
        item={{
          id: "attention",
          label: "Needs attention",
          value: String(data.attention.length),
          supporting: "Priority work",
          icon: "deals",
        }}
      />
    </div>
  );

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-1 border-b border-sales-border-subtle">
        {(
          [
            { value: "active" as const, label: "Active" },
            { value: "closed" as const, label: "Closed" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              setTab(opt.value);
              if (opt.value === "closed") setViewMode("board");
            }}
            className={cn(
              "relative -mb-px min-h-9 px-3 pb-2.5 text-[13px] font-semibold transition-colors",
              tab === opt.value
                ? "text-sales-text-primary"
                : "text-sales-text-secondary hover:text-sales-text-primary"
            )}
          >
            {opt.label}
            {tab === opt.value ? (
              <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-sales-brand" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        {tab === "active" ? (
          <SegmentedControl
            aria-label="Pipeline view"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: "board", label: "Board" },
              {
                value: "attention",
                label: "Attention",
                badge: data.attention.length > 0 ? data.attention.length : undefined,
              },
            ]}
          />
        ) : null}
        <label className="relative block min-w-0 flex-1 sm:max-w-[min(100%,17rem)]">
          <span className="sr-only">Search inquiries</span>
          <Search
            size={15}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search inquiries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-[10px] border border-sales-border bg-sales-surface py-2 pl-9 pr-3 text-[13px] text-sales-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-sales-text-muted focus:border-sales-border-strong focus:ring-2 focus:ring-sales-brand/40"
          />
        </label>
      </div>
    </div>
  );

  const overlay = openLeadId ? (
    <RealEstateInquiryWorkspace
      clientId={clientId}
      leadId={openLeadId}
      onClose={() => setOpenLeadId(null)}
      onCall={() => undefined}
      onWhatsApp={() => undefined}
      overlay
      stacked
    />
  ) : null;

  const board = (() => {
    if (tab === "closed") {
      return (
        <div className="space-y-3">
          {toolbar}
          {closedItems.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-4 w-4" strokeWidth={1.5} />}
              title={q ? `No inquiries match “${query.trim()}”` : "No closed inquiries yet"}
              description={q ? "Try another name or stage." : "Won, lost, and not-qualified inquiries appear here."}
              action={
                <Link href={inquiryBaseHref} className="text-[13px] font-medium text-sales-info-fg">
                  View all inquiries
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-sales-lg border border-sales-border bg-sales-surface shadow-sales-card">
              <ul className="divide-y divide-sales-border">
                {closedItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openInquiry(item.id)}
                      className="flex h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-sales-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{item.name}</p>
                        <p className="truncate text-[11px] text-sales-text-muted">
                          {item.ownerName ?? "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-sales-xs px-2 py-0.5 text-[11px] font-medium",
                          item.stage === "won"
                            ? "bg-sales-success-soft text-sales-success-fg"
                            : "bg-sales-danger-soft text-sales-danger-fg"
                        )}
                      >
                        {rePipelineStageLabel(item.stage)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (viewMode === "attention") {
      return (
        <div className="space-y-3">
          {toolbar}
          {data.attention.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-4 w-4" strokeWidth={1.5} />}
              title="Nothing needs attention right now"
              description="New inquiries, overdue follow-ups, and today’s viewings will show here."
            />
          ) : (
            <CardShell title="Needs attention" className="dashboard-panel--table">
              <ul className="divide-y divide-sales-border-subtle">
                {data.attention.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openInquiry(item.id)}
                      className="flex h-[52px] w-full items-center justify-between gap-3 px-5 text-left hover:bg-sales-surface-hover"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                            {item.name}
                          </p>
                          <DealSideBadge dealSide={item.dealSide} />
                        </div>
                        <p className="truncate text-[11px] text-sales-text-muted">
                          {item.why}
                          {" · "}
                          {item.nextLabel}
                        </p>
                      </div>
                      <span className="text-[12px] font-semibold text-sales-text-secondary">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardShell>
          )}
        </div>
      );
    }

    if (isNarrow) {
      const items = byGroup[mobileCol];
      const colMeta = RE_BOARD_COLUMNS.find((c) => c.id === mobileCol)!;
      return (
        <div className="space-y-3">
          {toolbar}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {RE_BOARD_COLUMNS.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setMobileCol(col.id)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors",
                  mobileCol === col.id
                    ? "bg-sales-brand-soft text-sales-text-primary ring-1 ring-sales-brand-border"
                    : "border border-sales-border bg-sales-surface text-sales-text-secondary"
                )}
              >
                {col.label} · {byGroup[col.id].length}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-sales-text-muted">
              No inquiries in {colMeta.label}.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <InquiryCard
                  key={item.id}
                  item={item}
                  showOwner={!embedded}
                  selected={openLeadId === item.id}
                  onOpen={openInquiry}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {toolbar}
        <div className="grid grid-cols-5 gap-3">
          {RE_BOARD_COLUMNS.map((col) => {
            const items = byGroup[col.id];
            return (
              <div key={col.id} className="min-w-0">
                <div
                  className="mb-2.5 flex items-center justify-between gap-2 border-t-[2px] px-0.5 pt-2"
                  style={{ borderColor: col.accent }}
                >
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-secondary">
                    {col.label}
                  </h3>
                  <span className="rounded-sales-xs bg-sales-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-sales-text-label">
                    {items.length}
                  </span>
                </div>
                <div className="min-h-[12rem] space-y-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[12px] text-sales-text-muted">
                      No inquiries
                    </p>
                  ) : (
                    items.slice(0, 8).map((item) => (
                      <InquiryCard
                        key={item.id}
                        item={item}
                        showOwner={!embedded}
                        selected={openLeadId === item.id}
                        onOpen={openInquiry}
                      />
                    ))
                  )}
                  {items.length > 8 ? (
                    <p className="py-1 text-center text-[11px] text-sales-text-muted">
                      +{items.length - 8} more
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  const companyExtra =
    !embedded && tab === "active" && viewMode === "board" && data.workload.length > 0 ? (
      <CardShell title="Agent workload" className="dashboard-panel--table">
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-left">
            <thead>
              <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
                <th className="px-5 py-2.5">Agent</th>
                <th className="px-3 py-2.5 text-right">Inquiries</th>
                <th className="px-3 py-2.5 text-right">Follow-ups</th>
                <th className="px-5 py-2.5 text-right">Viewings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(125,148,194,0.07)]">
              {data.workload.map((w) => (
                <tr key={w.id} className="dashboard-list-row h-[48px]">
                  <td className="px-5 text-[13px] font-medium text-sales-text-primary">{w.name}</td>
                  <td className="px-3 text-right text-[13px] tabular-nums">{w.activeInquiries}</td>
                  <td className="px-3 text-right text-[13px] tabular-nums">{w.followUpsDue}</td>
                  <td className="px-5 text-right text-[13px] tabular-nums">{w.viewingsThisWeek}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardShell>
    ) : null;

  const inner = (
    <div className="space-y-3">
      {kpis}
      {board}
      {companyExtra}
      {overlay}
    </div>
  );

  if (embedded) return inner;

  return (
    <CompanyWorkspaceShell
      companyName={clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      businessType="real_estate"
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead={false}
        breadcrumb="Company / Pipeline"
        title="Pipeline"
        description="Inquiries by stage, agent workload, and work that needs attention."
        primaryAction={null}
      />
      {inner}
    </CompanyWorkspaceShell>
  );
}
