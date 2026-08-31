"use client";

import { Footprints, Globe2, Phone, Radio, UserRoundPlus } from "lucide-react";
import { SiFacebook, SiInstagram, SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import {
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  MenuSelect,
  SearchInput,
} from "@/components/sales/ui";
import { formatConversionPct } from "@/lib/real-estate/marketing";
import {
  LEAD_SOURCE_COMPANY_TABS,
  type LeadSourceCompanySort,
  type LeadSourceCompanyTab,
  type LeadSourceRow,
} from "@/lib/real-estate/lead-sources";

function SourceMark({ sourceType, label }: { sourceType: string; label: string }) {
  const raw = sourceType.toLowerCase();
  let icon = <Globe2 size={13} strokeWidth={1.8} />;
  let tone = "bg-sales-neutral-100 text-sales-text-secondary";
  if (raw.includes("whatsapp")) {
    icon = <SiWhatsapp size={13} color="#25D366" aria-hidden />;
    tone = "bg-[rgba(37,211,102,0.10)] text-[#15803D] dark:text-[#74DB8E]";
  } else if (raw.includes("instagram")) {
    icon = <SiInstagram size={13} color="#E4405F" aria-hidden />;
    tone = "bg-[rgba(228,64,95,0.10)] text-[#C1354A] dark:text-[#F08AA0]";
  } else if (raw.includes("facebook")) {
    icon = <SiFacebook size={13} color="#1877F2" aria-hidden />;
    tone = "bg-[rgba(24,119,242,0.10)] text-[#1768C5] dark:text-[#79AEF7]";
  } else if (raw.includes("refer")) {
    icon = <UserRoundPlus size={13} strokeWidth={1.8} />;
    tone = "bg-[rgba(139,92,246,0.10)] text-[#6D3ED6] dark:text-[#B8A0F8]";
  } else if (raw.includes("walk")) {
    icon = <Footprints size={13} strokeWidth={1.8} />;
    tone = "bg-sales-warning-soft text-sales-warning-fg";
  } else if (raw.includes("phone")) {
    icon = <Phone size={13} strokeWidth={1.8} />;
    tone = "bg-sales-warning-soft text-sales-warning-fg";
  } else if (raw.includes("web") || raw.includes("portal")) {
    icon = <Globe2 size={13} strokeWidth={1.8} />;
    tone = "bg-[rgba(38,132,255,0.10)] text-[#1768C5] dark:text-[#79AEF7]";
  }
  return (
    <span
      className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", tone)}
      title={label}
      aria-hidden
    >
      {icon}
    </span>
  );
}

export function LeadSourcesTableCard({
  rows,
  tab,
  tabCounts,
  onTabChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  emptyKind,
  searchQuery,
  onClearSearch,
  rangeLabel,
}: {
  rows: LeadSourceRow[];
  tab: LeadSourceCompanyTab;
  tabCounts: Record<LeadSourceCompanyTab, number>;
  onTabChange: (tab: LeadSourceCompanyTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: LeadSourceCompanySort;
  onSortChange: (sort: LeadSourceCompanySort) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyKind: "none" | "search" | "rows";
  searchQuery: string;
  onClearSearch: () => void;
  rangeLabel: string;
}) {
  const empty = emptyKind !== "rows";
  const emptyTitle =
    emptyKind === "search" ? `No sources match “${searchQuery}”` : "No source data yet";
  const emptyDescription =
    emptyKind === "search"
      ? "Try a different search."
      : `Source attribution will appear as new inquiries are captured through connected channels · ${rangeLabel}.`;

  return (
    <section className="flex min-h-[660px] min-w-0 flex-col overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-col gap-3 border-b border-sales-border-subtle px-3 py-3 sm:px-4">
        <div
          className="scrollbar-hide flex min-w-0 gap-4 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Source groups"
        >
          {LEAD_SOURCE_COMPANY_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[13px] transition-colors duration-150",
                  active
                    ? "font-semibold text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {item.label}
                <span className="tabular-nums text-sales-text-muted">{tabCounts[item.id]}</span>
                {active ? (
                  <span className="absolute inset-x-0 -bottom-px h-[3px] bg-sales-brand" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search sources…"
            className="min-w-0 w-full sm:w-[240px]"
          />
          <MenuSelect
            value={sort}
            onChange={onSortChange}
            aria-label="Sort sources"
            align="right"
            options={[
              { value: "inquiries_desc", label: "Sort: Most inquiries" },
              { value: "conversion_desc", label: "Highest conversion" },
              { value: "source_asc", label: "Source A–Z" },
            ]}
          />
        </div>
      </div>

      {empty ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Radio className="h-4 w-4" strokeWidth={1.6} />}
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyKind === "search" ? (
                <button
                  type="button"
                  className="text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
                  onClick={onClearSearch}
                >
                  Clear search
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden min-w-0 flex-1 overflow-x-auto lg:block">
            <DataTableEl className="min-w-[860px]">
              <DataTableHead>
                <tr>
                  <DataTableTh>Source</DataTableTh>
                  <DataTableTh className="text-right">Inquiries</DataTableTh>
                  <DataTableTh className="text-right">Qualified</DataTableTh>
                  <DataTableTh className="text-right">Viewings</DataTableTh>
                  <DataTableTh className="text-right">Offers</DataTableTh>
                  <DataTableTh className="text-right">Accepted</DataTableTh>
                  <DataTableTh className="text-right">Conversion</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow
                    key={row.sourceType}
                    selected={row.sourceType === selectedId}
                    className="h-[62px] cursor-pointer"
                    onClick={() => onSelect(row.sourceType)}
                  >
                    <DataTableTd className="min-w-[200px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <SourceMark sourceType={row.sourceType} label={row.label} />
                        <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.label}</p>
                      </div>
                    </DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.inquiries}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.qualified}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.viewings}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.offers}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{row.accepted}</DataTableTd>
                    <DataTableTd className="text-right font-medium tabular-nums">
                      {formatConversionPct(row.conversion)}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </div>

          <div className="divide-y divide-sales-border-subtle lg:hidden">
            {rows.map((row) => (
              <button
                key={row.sourceType}
                type="button"
                onClick={() => onSelect(row.sourceType)}
                className={cn(
                  "w-full p-4 text-left transition-colors hover:bg-sales-surface-hover",
                  row.sourceType === selectedId && "bg-sales-brand-soft"
                )}
              >
                <div className="flex items-start gap-3">
                  <SourceMark sourceType={row.sourceType} label={row.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.label}</p>
                      <p className="shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                        {formatConversionPct(row.conversion)}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Inquiries</p>
                        <p className="mt-0.5 tabular-nums text-sales-text-primary">{row.inquiries}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Qualified</p>
                        <p className="mt-0.5 tabular-nums text-sales-text-primary">{row.qualified}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Viewings</p>
                        <p className="mt-0.5 tabular-nums text-sales-text-primary">{row.viewings}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-sales-text-muted">Offers</p>
                        <p className="mt-0.5 tabular-nums text-sales-text-primary">
                          {row.offers}
                          {row.accepted ? ` · ${row.accepted} accepted` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto border-t border-sales-border-subtle px-3 py-3 text-[11px] text-sales-text-muted sm:px-4">
        Showing {rows.length} source{rows.length === 1 ? "" : "s"} · {rangeLabel}
      </div>
    </section>
  );
}
