"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { AgentReDashboard } from "@/lib/sales/get-agent-real-estate-dashboard";
import {
  ReEmptyState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSkeletonRows,
  useReFetch,
} from "@/components/real-estate/ui";

type BuyerMetrics = {
  incomplete: boolean;
  metrics: {
    activeBuyers: number;
    activeTenants: number;
    newSearches: number;
    viewingsScheduled: number;
    offersInProgress: number;
    followUpDue: number;
  };
};

type MandateForm = {
  id: string;
  phase: "with_seller" | "complete";
  sellerName: string;
  property: string;
  contactId: string | null;
};

type Mark = "today" | "waiting";

type NeedRow = {
  key: string;
  group: Mark;
  name: string;
  meta: string;
  detail: string;
  action: string;
  href: string;
};

const GROUP_ORDER: Mark[] = ["today", "waiting"];

const GROUP_LABEL: Record<Mark, string> = {
  today: "Today",
  waiting: "Waiting",
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function NeedMark({ mark }: { mark: Mark }) {
  const tone = mark === "today" ? "bg-sales-brand" : "bg-sales-border";
  return <span className={`h-8 w-[3px] shrink-0 rounded-full ${tone}`} aria-hidden />;
}

function FilledAction({ href, label, name }: { href: string; label: string; name: string }) {
  return (
    <Link
      href={href}
      className="re-focus inline-flex h-9 shrink-0 items-center rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface transition-opacity hover:opacity-90"
    >
      {label}
      <span className="sr-only">: {name}</span>
    </Link>
  );
}

function LinedAction({ href, label, name }: { href: string; label: string; name: string }) {
  return (
    <Link
      href={href}
      className="re-focus inline-flex h-9 shrink-0 items-center rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
    >
      {label}
      <span className="sr-only">: {name}</span>
    </Link>
  );
}

export function AgentDailyWorkspace({
  clientId,
  data,
}: {
  clientId: string;
  firstName?: string;
  data: AgentReDashboard;
}) {
  const buyerMetrics = useReFetch<BuyerMetrics>(`/api/clients/${clientId}/buyer-searches?metrics=1`);
  const mandateForms = useReFetch<{ forms?: MandateForm[] }>(`/api/clients/${clientId}/mandate-forms`);

  const forms = mandateForms.status === "ready" ? mandateForms.data.forms ?? [] : [];
  const metrics = buyerMetrics.status === "ready" ? buyerMetrics.data.metrics : null;

  const needs = useMemo<NeedRow[]>(() => {
    const rows: NeedRow[] = [];
    for (const offer of data.offersNeedingAttention) {
      const waiting = offer.reason === "awaiting_seller";
      rows.push({
        key: `offer-${offer.id}`,
        group: waiting ? "waiting" : "today",
        name: offer.buyerName ?? "Buyer",
        meta: offer.amountLabel ? `Offer · ${offer.amountLabel}` : "Offer",
        detail: offer.why,
        action: "Open offer",
        href: `/sales/offers?offerId=${offer.id}`,
      });
    }
    for (const form of forms) {
      const ready = form.phase === "complete" && !form.contactId;
      rows.push({
        key: `form-${form.id}`,
        group: form.phase === "with_seller" ? "waiting" : "today",
        name: form.sellerName,
        meta: "Seller form",
        detail: ready
          ? `${form.property}. Opening the completed form creates the seller and a draft listing.`
          : `${form.property}. The form is still with the seller.`,
        action: "Open",
        href: "/sales/mandates",
      });
    }
    return GROUP_ORDER.flatMap((group) => rows.filter((row) => row.group === group));
  }, [data.offersNeedingAttention, forms]);

  const schedule = data.viewingsToday.map((viewing) => {
    const buyerHref = viewing.buyerSearchId ? `/sales/buyers/${viewing.buyerSearchId}` : null;
    return {
      key: viewing.id,
      time: timeLabel(viewing.scheduledAt),
      name: viewing.contactName ?? "Buyer",
      detail: `Viewing · ${viewing.listingLabel}`,
      href: buyerHref ?? `/sales/listings/${viewing.listingId}`,
    };
  });

  const count = needs.length;
  const toOpen = needs.filter((row) => row.group === "today").length;
  const waiting = needs.filter((row) => row.group === "waiting").length;
  const summary =
    mandateForms.status === "loading" && count === 0
      ? "Checking offers and seller forms."
      : count === 0
        ? "No offers or seller forms to open."
        : [toOpen ? `${toOpen} to open today.` : null, waiting ? `${waiting} waiting.` : null].filter(Boolean).join(" ");

  const buyerDetail =
    buyerMetrics.status === "loading"
      ? "Loading buyers and tenants"
      : buyerMetrics.status === "error"
        ? "Buyers and tenants could not be counted"
        : metrics
          ? `${metrics.activeBuyers} buyers · ${metrics.activeTenants} tenants`
          : "Buyers and tenants";
  const sellerForms = forms.length;
  const sellerDetail =
    mandateForms.status === "loading"
      ? "Loading seller forms"
      : mandateForms.status === "error"
        ? "Seller forms could not be counted"
        : `${sellerForms} ${sellerForms === 1 ? "seller form" : "seller forms"}`;
  const salesCount = data.summary.transactionsNeedingAttention;

  return (
    <div className="space-y-5">
      <RePageHeader
        mobileTitle
        context={todayLabel()}
        title="Today"
        description={summary}
        actions={
          <>
            <Link
              href="/sales/buyers?new=1"
              className="re-focus inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
            >
              Add buyer
            </Link>
            <Link
              href="/sales/mandates"
              className="re-focus inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden />
              New seller form
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
        <ReSection id="re-agent-attention" title="Needs you" count={mandateForms.status === "loading" && count === 0 ? null : count} flush>
          {mandateForms.status === "error" ? (
            <RePartialNotice>
              Seller forms didn&apos;t load.{" "}
              <button type="button" className="re-focus rounded-[4px] font-semibold underline" onClick={mandateForms.reload}>
                Try again
              </button>
            </RePartialNotice>
          ) : null}
          {mandateForms.status === "loading" && count === 0 ? (
            <ReSkeletonRows rows={1} label="Loading offers and seller forms" />
          ) : count === 0 ? (
            <ReEmptyState title="Nothing to open" description="Offers and seller forms show here." />
          ) : (
            <ul>
              {GROUP_ORDER.map((group) => {
                const rows = needs.filter((row) => row.group === group);
                if (rows.length === 0) return null;
                return (
                  <li key={group} className="list-none">
                    <p className="border-t border-sales-border-subtle bg-sales-bg px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">
                      {GROUP_LABEL[group]}
                    </p>
                    <ul>
                      {rows.map((row) => (
                        <li key={row.key} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                          <NeedMark mark={row.group} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.name}</p>
                            <p className="truncate text-[12px] text-sales-text-muted">{row.meta}</p>
                            <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{row.detail}</p>
                          </div>
                          <FilledAction href={row.href} label={row.action} name={row.name} />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </ReSection>

        <ReSection id="re-agent-schedule" title="Schedule" count={schedule.length} flush>
          {schedule.length === 0 ? (
            <ReEmptyState compact title="Nothing scheduled today" description="A signed viewing form puts the appointment here." />
          ) : (
            <ul>
              {schedule.map((row) => (
                <li key={row.key} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                  <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-secondary">{row.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-sales-text-primary">{row.name}</p>
                    <p className="truncate text-[12px] text-sales-text-muted">{row.detail}</p>
                  </div>
                  <LinedAction href={row.href} label="Open" name={row.name} />
                </li>
              ))}
            </ul>
          )}
        </ReSection>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface sm:grid-cols-4">
        <Metric label="New inquiries" value={data.summary.newInquiries} />
        <Metric label="Follow-ups due" value={data.summary.followUpsDue} attention={data.summary.followUpsDue > 0} />
        <Metric label="Viewings" value={data.summary.viewingsToday} />
        <Metric label="Offers" value={metrics?.offersInProgress ?? data.offersNeedingAttention.length} />
      </div>

      <ReSection id="re-agent-work" title="My work" flush>
        <ul>
          <QuietRow name="Buyers and tenants" detail={buyerDetail} href="/sales/buyers" />
          <QuietRow name="Sellers" detail={sellerDetail} href="/sales/owners" />
          <QuietRow
            name="Sales"
            detail={`${salesCount} ${salesCount === 1 ? "sale is" : "sales are"} moving to completion`}
            href="/sales/transactions"
          />
        </ul>
      </ReSection>
    </div>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className="border-b border-r border-sales-border-subtle px-4 py-3 last:border-r-0 sm:border-b-0">
      <p className={`font-display text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${attention ? "text-sales-danger-fg" : "text-sales-text-primary"}`}>
        {value}
      </p>
      <p className="mt-1 text-[12px] text-sales-text-muted">{label}</p>
    </div>
  );
}

function QuietRow({ name, detail, href }: { name: string; detail: string; href: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</p>
        <p className="truncate text-[13px] text-sales-text-secondary">{detail}</p>
      </div>
      <LinedAction href={href} label="Open" name={name} />
    </li>
  );
}
