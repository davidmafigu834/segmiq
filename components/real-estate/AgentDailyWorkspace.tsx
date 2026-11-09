"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, ClipboardList, ScrollText, UsersRound } from "lucide-react";
import type { AgentReDashboard } from "@/lib/sales/get-agent-real-estate-dashboard";
import { cn } from "@/lib/ui/cn";
import {
  ReActionMenu,
  ReEmptyState,
  ReErrorState,
  ReFigureList,
  ReGroupLabel,
  ReList,
  ReMetricGrid,
  ReMetricOverview,
  RePageHeader,
  RePartialNotice,
  ReQuickActions,
  ReRowAction,
  ReSection,
  ReSkeletonRows,
  ReStatCard,
  ReStatusBadge,
  ReViewAll,
  ReWorkItem,
  useReFetch,
  type ReAction,
  type ReUrgency,
} from "@/components/real-estate/ui";

const ATTENTION_PREVIEW = 8;
const MOBILE_ATTENTION_PREVIEW = 3;
const WITH_SELLER = "With the seller to approve";
const BUYER_HAS_LETTER = "The buyer still has the letter";
const LETTER_NOT_SENT = "The letter has not been sent to the seller";

type BuyerPriority = { id: string; title: string; detail: string; action: string };

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

type OfferLetter = {
  id: string;
  buyerName: string | null;
  propertyLabel: string;
  sellerLetter: string;
};

type AttentionGroup = "today" | "awaiting" | "opportunity";

const GROUP_LABEL: Record<AttentionGroup, string> = {
  today: "Due today",
  awaiting: "Waiting on someone",
  opportunity: "Opportunities",
};

const GROUP_ORDER: AttentionGroup[] = ["today", "awaiting", "opportunity"];

const GROUP_URGENCY: Record<AttentionGroup, ReUrgency> = {
  today: "today",
  awaiting: "awaiting",
  opportunity: "opportunity",
};

type AttentionEntry = {
  key: string;
  group: AttentionGroup;
  title: string;
  reason: string;
  statusLabel: string;
  action: { label: string; onClick?: () => void; href?: string };
  menu: ReAction[];
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function withTheBuyer(letter: string): boolean {
  return letter === BUYER_HAS_LETTER || letter === LETTER_NOT_SENT;
}

function ActiveWorkTile({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <article className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--re-radius-card,12px)] border border-[var(--sales-card-border,var(--sales-border-subtle))] bg-sales-surface px-3 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-[14px] font-semibold leading-tight text-sales-text-primary">{title}</h3>
        <p className="mt-0.5 truncate text-[13px] leading-snug text-sales-text-secondary">{detail}</p>
      </div>
      <ReViewAll href={href} />
    </article>
  );
}

function AttentionCard({ entry, group, className }: { entry: AttentionEntry; group: AttentionGroup; className?: string }) {
  return (
    <li className={cn("flex min-w-0 items-center gap-3 px-3 py-3 sm:px-[var(--re-card-pad,16px)]", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 text-[15px] font-semibold leading-snug text-sales-text-primary [overflow-wrap:anywhere]">{entry.title}</p>
          <ReStatusBadge label={entry.statusLabel} urgency={GROUP_URGENCY[group]} />
        </div>
        <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary [overflow-wrap:anywhere]">{entry.reason}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ReRowAction label={entry.action.label} srContext={entry.title} onClick={entry.action.onClick} href={entry.action.href} />
        {entry.menu.length > 0 ? (
          <ReActionMenu label={`More actions for ${entry.title}`} sheetTitle={entry.title} actions={entry.menu} />
        ) : null}
      </div>
    </li>
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
  const router = useRouter();
  const [showAllAttention, setShowAllAttention] = useState(false);

  const buyerReports = useReFetch<{ priorities?: BuyerPriority[] }>(`/api/clients/${clientId}/buyer-reports`);
  const buyerMetrics = useReFetch<BuyerMetrics>(`/api/clients/${clientId}/buyer-searches?metrics=1`);
  const mandateForms = useReFetch<{ forms?: MandateForm[] }>(`/api/clients/${clientId}/mandate-forms`);
  const offerLetters = useReFetch<{ offers?: OfferLetter[] }>(`/api/clients/${clientId}/offers?tab=all`);

  const formRows = mandateForms.status === "ready" ? mandateForms.data.forms : undefined;
  const offerRows = offerLetters.status === "ready" ? offerLetters.data.offers : undefined;
  const matchRows = buyerReports.status === "ready" ? buyerReports.data.priorities : undefined;
  const waitingForms = useMemo(() => (formRows ?? []).filter((form) => form.phase === "with_seller"), [formRows]);
  const readyForms = useMemo(() => (formRows ?? []).filter((form) => form.phase === "complete" && !form.contactId), [formRows]);
  const buyerLetters = useMemo(() => (offerRows ?? []).filter((offer) => withTheBuyer(offer.sellerLetter)), [offerRows]);
  const sellerLetters = useMemo(() => (offerRows ?? []).filter((offer) => offer.sellerLetter === WITH_SELLER), [offerRows]);
  const matches = useMemo(() => (matchRows ?? []).filter((item) => item.id.startsWith("match-")), [matchRows]);

  const attention = useMemo<AttentionEntry[]>(() => {
    const entries: AttentionEntry[] = [];
    for (const viewing of data.viewingsToday) {
      const buyerHref = viewing.buyerSearchId ? `/sales/buyers/${viewing.buyerSearchId}` : null;
      const propertyHref = `/sales/listings/${viewing.listingId}`;
      entries.push({
        key: `viewing-${viewing.id}`,
        group: "today",
        title: viewing.contactName ?? "Buyer",
        reason: `Viewing · ${viewing.listingLabel} · ${timeLabel(viewing.scheduledAt)}`,
        statusLabel: "Viewing today",
        action: buyerHref
          ? { label: "Open buyer", href: buyerHref }
          : { label: "Open property", href: propertyHref },
        menu: [
          ...(buyerHref
            ? [{ id: "property", label: "Open property", onSelect: () => router.push(propertyHref) }]
            : []),
        ],
      });
    }
    for (const form of readyForms) {
      entries.push({
        key: `form-ready-${form.id}`,
        group: "today",
        title: form.sellerName,
        reason: `${form.property}. Opening the completed form creates the seller and a draft listing.`,
        statusLabel: "Completed form",
        action: { label: "Open", href: "/sales/mandates" },
        menu: [],
      });
    }
    for (const offer of buyerLetters) {
      entries.push({
        key: `letter-buyer-${offer.id}`,
        group: "today",
        title: offer.buyerName ?? "Buyer",
        reason: `${offer.propertyLabel}. ${offer.sellerLetter}.`,
        statusLabel: "With the buyer",
        action: { label: "Open letter", href: `/sales/offers?offerId=${offer.id}` },
        menu: [],
      });
    }
    for (const form of waitingForms) {
      entries.push({
        key: `form-wait-${form.id}`,
        group: "awaiting",
        title: form.sellerName,
        reason: `${form.property}. The form is still with the seller.`,
        statusLabel: "With the seller",
        action: { label: "Open", href: "/sales/mandates" },
        menu: [],
      });
    }
    for (const offer of sellerLetters) {
      entries.push({
        key: `letter-seller-${offer.id}`,
        group: "awaiting",
        title: offer.buyerName ?? "Buyer",
        reason: `${offer.propertyLabel}. The seller has the letter to approve.`,
        statusLabel: "With the seller",
        action: { label: "Open letter", href: `/sales/offers?offerId=${offer.id}` },
        menu: [],
      });
    }
    for (const match of matches) {
      entries.push({
        key: `match-${match.id}`,
        group: "opportunity",
        title: match.title,
        reason: match.detail,
        statusLabel: "New matches",
        action: { label: "Open buyer", href: `/sales/buyers/${match.id.slice("match-".length)}` },
        menu: [],
      });
    }
    return GROUP_ORDER.flatMap((group) => entries.filter((entry) => entry.group === group));
  }, [buyerLetters, data.viewingsToday, matches, readyForms, router, sellerLetters, waitingForms]);

  const shownAttention = showAllAttention ? attention : attention.slice(0, ATTENTION_PREVIEW);

  const schedule = useMemo(() => {
    return data.viewingsToday.map((viewing) => {
      const buyerHref = viewing.buyerSearchId ? `/sales/buyers/${viewing.buyerSearchId}` : null;
      const propertyHref = `/sales/listings/${viewing.listingId}`;
      return {
        key: `v-${viewing.id}`,
        when: timeLabel(viewing.scheduledAt),
        title: viewing.contactName ?? "Buyer",
        detail: `Viewing · ${viewing.listingLabel}`,
        action: buyerHref
          ? { label: "Open buyer", href: buyerHref }
          : { label: "Open property", href: propertyHref },
        menu: buyerHref
          ? [{ id: "property", label: "Open property", onSelect: () => router.push(propertyHref) }]
          : [],
      };
    });
  }, [data.viewingsToday, router]);

  const metrics = buyerMetrics.status === "ready" ? buyerMetrics.data.metrics : null;
  const extrasLoading = mandateForms.status === "loading" || offerLetters.status === "loading" || buyerReports.status === "loading";

  const quickActions = {
    primary: {
      id: "mandate",
      label: "New seller form",
      description: "A completed form opens the seller and a draft listing",
      icon: <ScrollText size={16} strokeWidth={1.8} />,
      onSelect: () => router.push("/sales/mandates"),
    },
    secondary: [
      {
        id: "buyer",
        label: "Add buyer",
        description: "Open buyers and tenants to add someone",
        icon: <UsersRound size={16} strokeWidth={1.8} />,
        onSelect: () => router.push("/sales/buyers?new=1"),
      },
      {
        id: "viewing",
        label: "Viewing form",
        description: "Copy a viewing form from a property",
        icon: <CalendarPlus size={16} strokeWidth={1.8} />,
        onSelect: () => router.push("/sales/listings"),
      },
    ],
  };

  const attentionCount = attention.length;
  const daySummary =
    attentionCount > 0
      ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your next action`
      : extrasLoading
        ? "Checking seller forms, viewings, and offer letters"
        : "Nothing needs your next action right now";

  let mobileSeen = 0;
  const attentionBlocks = GROUP_ORDER.flatMap((group) => {
    const items = shownAttention.filter((entry) => entry.group === group);
    if (items.length === 0) return [];
    const cards = items.map((entry) => {
      const extra = !showAllAttention && mobileSeen >= MOBILE_ATTENTION_PREVIEW;
      mobileSeen += 1;
      return { entry, extra };
    });
    return [{ group, total: attention.filter((entry) => entry.group === group).length, cards, labelExtra: cards.every((card) => card.extra) }];
  });

  return (
    <div className="space-y-3 layout:space-y-[var(--re-section-gap,16px)]">
      <header className="layout:hidden">
        <p className="text-[12px] font-medium leading-4 text-sales-text-muted">{todayLabel()}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="min-w-0 font-display text-[24px] font-semibold leading-none tracking-[-0.02em] text-sales-text-primary">Today</h1>
          <div className="shrink-0">
            <ReQuickActions primary={quickActions.primary} secondary={quickActions.secondary} sheetTitle="New" />
          </div>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary">{daySummary}</p>
      </header>
      <RePageHeader
        className="hidden layout:flex"
        context={todayLabel()}
        title="Today"
        description={
          attentionCount > 0
            ? `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your next action.`
            : extrasLoading
              ? "Checking seller forms, viewings, and offer letters."
              : "Nothing needs your next action right now."
        }
        actions={<ReQuickActions primary={quickActions.primary} secondary={quickActions.secondary} sheetTitle="New" />}
      />

      <div className="grid grid-cols-1 items-start gap-3 layout:grid-cols-12 layout:gap-[var(--re-section-gap,16px)]">
        <ReSection
          id="re-agent-attention"
          title="Needs your attention"
          description="Seller forms, viewings today, and offer letters that need the next step."
          hideMobileDescription
          count={attentionCount}
          className="order-1 layout:order-none layout:col-span-8"
          flush
        >
          {mandateForms.status === "error" || offerLetters.status === "error" || buyerReports.status === "error" ? (
            <RePartialNotice>
              Part of this list didn&apos;t load.{" "}
              <button
                type="button"
                className="re-focus rounded-[4px] font-semibold underline"
                onClick={() => {
                  if (mandateForms.status === "error") mandateForms.reload();
                  if (offerLetters.status === "error") offerLetters.reload();
                  if (buyerReports.status === "error") buyerReports.reload();
                }}
              >
                Try again
              </button>
            </RePartialNotice>
          ) : null}
          {attention.length === 0 ? (
            extrasLoading ? (
              <ReSkeletonRows rows={1} label="Loading what needs your next action" />
            ) : (
              <ReEmptyState
                title="Nothing needs your attention right now"
                description="Seller forms still with the seller, viewings today, and letters with the buyer or the seller show here."
              />
            )
          ) : (
            <>
              <ReList label="Items that need your attention">
                {attentionBlocks.map((block) => [
                  <ReGroupLabel key={`label-${block.group}`} count={block.total} className={block.labelExtra ? "max-[1099px]:hidden" : undefined}>
                    {GROUP_LABEL[block.group]}
                  </ReGroupLabel>,
                  ...block.cards.map(({ entry, extra }) => (
                    <AttentionCard key={entry.key} entry={entry} group={block.group} className={extra ? "max-[1099px]:hidden" : undefined} />
                  )),
                ])}
              </ReList>
              {attention.length > MOBILE_ATTENTION_PREVIEW ? (
                <div className={cn("border-t border-sales-border-subtle px-[var(--re-card-pad,16px)] py-2", attention.length <= ATTENTION_PREVIEW && "layout:hidden")}>
                  <button
                    type="button"
                    aria-expanded={showAllAttention}
                    aria-controls="re-agent-attention"
                    onClick={() => setShowAllAttention((value) => !value)}
                    className="re-focus inline-flex min-h-11 items-center rounded-[var(--re-radius-control,8px)] px-2 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover sm:min-h-9"
                  >
                    {showAllAttention ? "Show fewer" : `Show all ${attention.length}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </ReSection>

        <div className="order-3 layout:order-first layout:col-span-12">
          <h2 className="sr-only">My sales snapshot</h2>
          <ReMetricOverview label="My sales snapshot" quiet>
            <ReMetricGrid label="My sales snapshot">
              <ReStatCard
                label="Seller forms"
                value={mandateForms.status === "ready" ? waitingForms.length + readyForms.length : null}
                supporting="With the seller, or ready to open"
                href="/sales/mandates"
                state={mandateForms.status}
              />
              <ReStatCard label="Viewings today" value={data.summary.viewingsToday} supporting="Scheduled" href="/sales/viewings" />
              <ReStatCard
                label="With the buyer"
                value={offerLetters.status === "ready" ? buyerLetters.length : null}
                supporting="The letter is still with the buyer"
                href="/sales/offers"
                state={offerLetters.status}
              />
              <ReStatCard
                label="With the seller"
                value={offerLetters.status === "ready" ? sellerLetters.length : null}
                supporting="Waiting for the seller to approve"
                href="/sales/offers"
                state={offerLetters.status}
              />
            </ReMetricGrid>
          </ReMetricOverview>
        </div>

        <ReSection
          id="re-agent-schedule"
          title="Today's schedule"
          count={schedule.length}
          className="order-2 layout:order-none layout:col-span-4"
          flush
          action={<ReViewAll href="/sales/calendar" label="Calendar" />}
        >
          {schedule.length === 0 ? (
            <ReEmptyState
              title="Nothing scheduled today"
              description="A signed viewing form puts the appointment here and on the calendar."
              compact
            />
          ) : (
            <ul aria-label="Today's schedule" className="divide-y divide-sales-border-subtle">
              {schedule.map((row) => (
                <li key={row.key} className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-[var(--re-card-pad,16px)]">
                  <span className="w-12 shrink-0 text-[12px] font-semibold tabular-nums text-sales-text-secondary">{row.when}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold leading-snug text-sales-text-primary">{row.title}</p>
                    <p className="truncate text-[12px] leading-snug text-sales-text-muted">{row.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ReRowAction label={row.action.label} srContext={row.title} href={row.action.href} />
                    {row.menu.length > 0 ? (
                      <ReActionMenu label={`More actions for ${row.title}`} sheetTitle={row.title} actions={row.menu} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ReSection>

        <div className="order-2 min-w-0 layout:order-none layout:col-span-12">
          <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.01em] text-sales-text-primary layout:mb-3">My active work</h2>
          <div className="grid grid-cols-1 gap-2 layout:hidden">
            <ActiveWorkTile
              title="Buyers and tenants"
              detail={
                buyerMetrics.status === "loading"
                  ? "Loading"
                  : buyerMetrics.status === "error"
                    ? "Could not load"
                    : metrics
                      ? `${metrics.activeBuyers} active buyers · ${metrics.activeTenants} active tenants`
                      : "—"
              }
              href="/sales/buyers"
            />
            <ActiveWorkTile title="Seller mandates" detail="Form, inspection, then the listing" href="/sales/mandates" />
          </div>
          <div className="hidden items-start gap-[var(--re-section-gap,16px)] layout:grid layout:grid-cols-2">
            <ReSection id="re-agent-buyers" title="Buyers & tenants" action={<ReViewAll href="/sales/buyers" />}>
              {buyerMetrics.status === "loading" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReSkeletonRows rows={3} variant="figure" label="Loading buyer searches" />
                </div>
              ) : buyerMetrics.status === "error" ? (
                <div className="-mx-[var(--re-card-pad,16px)]">
                  <ReErrorState onRetry={buyerMetrics.reload} />
                </div>
              ) : metrics ? (
                <>
                  <ReFigureList
                    items={[
                      { label: "Active buyers", value: metrics.activeBuyers, href: "/sales/buyers" },
                      { label: "Active tenants", value: metrics.activeTenants, href: "/sales/buyers" },
                      { label: "Viewings booked", value: metrics.viewingsScheduled, href: "/sales/viewings" },
                    ]}
                  />
                  <p className="mt-3 text-[12px] leading-snug text-sales-text-muted">
                    A signed viewing form opens the buyer on the property they asked to see.
                  </p>
                  {buyerMetrics.data.incomplete ? (
                    <p className="mt-2 text-[12px] text-sales-warning-fg">Some searches could not be counted.</p>
                  ) : null}
                </>
              ) : null}
            </ReSection>

            <ReSection id="re-agent-sellers" title="Seller mandates" flush action={<ReViewAll href="/sales/mandates" />}>
              <ReList label="Seller workflow">
                <ReWorkItem
                  icon={<ScrollText />}
                  title="Mandates"
                  reason="Send the seller form and open a completed form as that seller."
                  action={<ReRowAction label="Open" srContext="Mandates" href="/sales/mandates" />}
                />
                <ReWorkItem
                  icon={<ClipboardList />}
                  title="Inspections"
                  reason="Visits still to record."
                  action={<ReRowAction label="Open" srContext="Inspections" href="/sales/inspections" />}
                />
                <ReWorkItem
                  icon={<Building2 />}
                  title="Sellers"
                  reason="People with a property on file."
                  action={<ReRowAction label="Open" srContext="Sellers" href="/sales/owners" />}
                />
              </ReList>
            </ReSection>
          </div>
        </div>
      </div>
    </div>
  );
}
