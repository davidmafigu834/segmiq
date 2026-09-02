"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Circle, FileText, MessageSquare, Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { DealRow, LeadRow, QuotationRow } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import {
  getDealCommercialValue,
  latestQuoteTotal,
} from "@/lib/sales/deals/commercial-value";
import type { DealCompletenessResult } from "@/lib/sales/deals/completeness";
import { getDealCompleteness } from "@/lib/sales/deals/completeness";
import type { DealTimelineItem } from "@/lib/sales/deals/timeline";
import { getDealNextActionState } from "@/lib/sales/deals/timeline";
import { DealNextBestActionPanel } from "@/components/sales/deals/DealNextBestActionPanel";
import { canCreateDealRevision, classifyDealQuotations } from "@/lib/sales/deals/current-quotation";
import {
  DEAL_ACTIVE_STAGES,
  DEAL_STAGE_LABEL,
  formatDealStage,
  formatDealValueBasis,
  isDealClosedStage,
} from "@/lib/sales/deals/display";
import { LOST_REASONS } from "@/lib/call-log-constants";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import { timeAgo } from "@/lib/sales-priority-lead";
import { formatQuoteStatus } from "@/lib/sales/quotes/format";
import { cn } from "@/lib/ui/cn";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Timeline,
  type TimelineItem,
} from "@/components/sales/ui";
import {
  DealDetailsEditorSheet,
  type DealDetailsFocus,
} from "@/components/sales/deals/DealDetailsEditorSheet";
import { SalesCommandDrawer } from "@/components/sales/command/SalesCommandDrawer";
import { EntityDocumentsPanel } from "@/components/dashboard/company/documents/EntityDocumentsPanel";

type NextActionState = {
  hasNextAction: boolean;
  isOverdue: boolean;
  label: string | null;
  at: string | null;
  emptyMessage: string;
};

function stageBadgeTone(stage: string): "neutral" | "brand" | "info" | "purple" | "warning" | "success" | "danger" {
  if (stage === "QUALIFIED") return "info";
  if (stage === "SCOPING") return "brand";
  if (stage === "PROPOSAL_SENT") return "purple";
  if (stage === "NEGOTIATING") return "warning";
  if (stage === "WON") return "success";
  if (stage === "LOST") return "danger";
  return "neutral";
}

function quoteStatusTone(status: string): "neutral" | "brand" | "info" | "success" | "danger" | "warning" {
  if (status === "draft") return "neutral";
  if (status === "sent" || status === "viewed") return "info";
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  if (status === "expired") return "warning";
  return "neutral";
}

export function DealWorkspaceClient({
  initialDeal,
  lead,
  quotes: initialQuotes,
  commercial: initialCommercial,
  completeness: initialCompleteness,
  nextAction: initialNext,
  timeline,
  openClose,
  repName,
  backHref = "/sales/pipeline",
  backLabel = "Back to pipeline",
  quoteHrefMode = "sales",
  canCreateQuote = true,
}: {
  initialDeal: DealRow;
  lead: LeadRow | null;
  quotes: QuotationRow[];
  commercial: DealCommercialValue;
  completeness: DealCompletenessResult;
  nextAction: NextActionState;
  timeline: DealTimelineItem[];
  openClose: "won" | "lost" | null;
  repName: string;
  backHref?: string;
  backLabel?: string;
  quoteHrefMode?: "sales" | "company";
  canCreateQuote?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deal, setDeal] = useState(initialDeal);
  const [quotes, setQuotes] = useState(initialQuotes);
  const { current: currentQuote, previous: previousQuotes } = useMemo(
    () => classifyDealQuotations(quotes),
    [quotes]
  );
  const [revising, setRevising] = useState(false);

  function quoteHref(id: string) {
    return quoteHrefMode === "company"
      ? `/client/quotations?quotation=${id}`
      : `/sales/quotes/${id}`;
  }
  const [commercial, setCommercial] = useState(initialCommercial);
  const [completeness, setCompleteness] = useState(initialCompleteness);
  const [nextAction, setNextAction] = useState(initialNext);
  const [moving, setMoving] = useState(false);
  const [closeMode, setCloseMode] = useState<"won" | "lost" | null>(openClose);
  const [wonValue, setWonValue] = useState(() =>
    commercial.kind === "amount" ? String(commercial.amount) : ""
  );
  const [lostReason, setLostReason] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsFocus, setDetailsFocus] = useState<DealDetailsFocus>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const edit = searchParams.get("edit");
    if (edit === "details" || edit === "value" || edit === "next") {
      setDetailsFocus(
        edit === "value" ? "value" : edit === "next" ? "next_action" : null
      );
      setDetailsOpen(true);
    }
  }, [searchParams]);

  function openDetails(focus: DealDetailsFocus = null) {
    setDetailsFocus(focus);
    setDetailsOpen(true);
  }

  function applyDealUpdate(updated: DealRow) {
    const latest = latestQuoteTotal(quotes);
    setDeal(updated);
    setCommercial(getDealCommercialValue(updated, { latestQuoteTotal: latest }));
    setCompleteness(
      getDealCompleteness(updated, {
        latestQuoteTotal: latest,
        hasNextAction: Boolean(updated.next_action_at),
      })
    );
    setNextAction(getDealNextActionState(updated));
    router.refresh();
  }

  const customerName = lead?.name?.trim() || "Customer";
  const closed = isDealClosedStage(deal.stage);

  const knownFields = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (deal.service_summary || lead?.customer_need) {
      rows.push({
        label: "Need",
        value: (lead?.customer_need || deal.service_summary || "").trim(),
      });
    }
    if (deal.customer_budget != null && deal.customer_budget > 0) {
      rows.push({
        label: "Budget",
        value: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(deal.customer_budget),
      });
    } else if (deal.estimated_value_min != null && deal.estimated_value_max != null) {
      rows.push({
        label: "Budget",
        value: `$${deal.estimated_value_min.toLocaleString()}–$${deal.estimated_value_max.toLocaleString()}`,
      });
    }
    if (deal.buying_timeframe) {
      rows.push({ label: "Buying timeframe", value: deal.buying_timeframe });
    }
    if (deal.decision_maker_name || deal.decision_maker_status === "YES") {
      rows.push({
        label: "Decision maker",
        value: deal.decision_maker_name || customerName,
      });
    }
    if (deal.location) rows.push({ label: "Location", value: deal.location });
    if (deal.expected_decision_at) {
      rows.push({
        label: "Expected decision",
        value: new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
      });
    }
    return rows.filter((r) => r.value);
  }, [deal, lead, customerName]);

  const timelineItems: TimelineItem[] = useMemo(
    () =>
      timeline.slice(0, 40).map((ev) => ({
        id: ev.id,
        title: ev.label,
        description: ev.detail,
        timeLabel: new Date(ev.at).toLocaleString(undefined, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        tone:
          ev.eventType === "DEAL_WON"
            ? "success"
            : ev.eventType === "DEAL_LOST"
              ? "danger"
              : ev.eventType.startsWith("DEAL_")
                ? "brand"
                : "neutral",
      })),
    [timeline]
  );

  async function patchDeal(body: Record<string, unknown>) {
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      deal?: DealRow;
      error?: string;
    };
    if (!res.ok || !json.deal) throw new Error(json.error || "Update failed");
    applyDealUpdate(json.deal);
    return json.deal;
  }

  async function moveStage(stage: string) {
    if (closed || moving || stage === deal.stage) return;
    setMoving(true);
    try {
      await patchDeal({ stage });
    } finally {
      setMoving(false);
    }
  }

  async function createRevision(quoteId: string) {
    if (revising) return;
    setRevising(true);
    try {
      const res = await fetch(`/api/quotations/${quoteId}/revise`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { quotation?: QuotationRow; error?: string };
      if (!res.ok || !json.quotation) return;
      setQuotes((prev) => [json.quotation!, ...prev.filter((q) => q.id !== json.quotation!.id)]);
      router.push(quoteHref(json.quotation.id));
    } finally {
      setRevising(false);
    }
  }

  async function submitClose() {
    setCloseError(null);
    setClosing(true);
    try {
      if (closeMode === "won") {
        const n = Number(String(wonValue).replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(n) || n < 0) {
          setCloseError("Enter a valid final value.");
          return;
        }
        await patchDeal({
          close: { outcome: "WON", wonValue: n },
        });
      } else if (closeMode === "lost") {
        if (!lostReason.trim()) {
          setCloseError("Select a lost reason.");
          return;
        }
        await patchDeal({
          close: { outcome: "LOST", lostReason: lostReason.trim() },
        });
      }
      setCloseMode(null);
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : "Could not close deal.");
    } finally {
      setClosing(false);
    }
  }

  function callCustomer() {
    if (!lead?.phone) return;
    window.location.href = `tel:${lead.phone}`;
  }

  function whatsappCustomer() {
    if (!lead) return;
    void openWhatsAppAndLog({
      leadId: lead.id,
      clientId: lead.client_id,
      leadName: lead.name,
      leadPhone: lead.phone,
      repName,
      formData: (lead.form_data as Record<string, unknown> | null) ?? null,
      tier: "neutral",
    });
  }

  const activeIdx = DEAL_ACTIVE_STAGES.indexOf(
    deal.stage as (typeof DEAL_ACTIVE_STAGES)[number]
  );

  const metaItems = [
    {
      label: "Estimated value",
      value: commercial.display,
      hint: commercial.kind !== "pending" ? formatDealValueBasis(commercial.basis) : null,
    },
    {
      label: "Expected decision",
      value: deal.expected_decision_at
        ? new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })
        : "Not set",
      hint: null,
    },
    {
      label: "Last contact",
      value: deal.last_meaningful_activity_at
        ? timeAgo(deal.last_meaningful_activity_at)
        : timeAgo(deal.updated_at),
      hint: null,
    },
    {
      label: "Next action",
      value: nextAction.hasNextAction ? nextAction.label || "Scheduled" : "None",
      hint: nextAction.isOverdue ? "Overdue" : null,
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sales-md px-2 text-[13px] font-medium text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          {backLabel}
        </Link>
      </div>

      {/* Header */}
      <Card className="mb-4">
        <CardContent className="space-y-5 pt-5">
          <div className="flex flex-col gap-4 layout:flex-row layout:items-start layout:justify-between">
            <div className="min-w-0">
              <p className="sales-type-label uppercase tracking-[0.06em] text-sales-text-muted">
                {customerName}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={stageBadgeTone(deal.stage)} appearance="soft">
                  {formatDealStage(deal.stage)}
                </Badge>
                {lead?.score != null ? (
                  <span className="text-[12px] text-sales-text-muted">
                    Origin intent {lead.score}
                  </span>
                ) : null}
              </div>
            </div>

            {!closed ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Phone size={16} strokeWidth={1.8} />}
                  onClick={callCustomer}
                  disabled={!lead?.phone}
                >
                  Call
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<SiWhatsapp size={16} color="#25D366" />}
                  onClick={whatsappCustomer}
                  disabled={!lead}
                >
                  WhatsApp
                </Button>
                {lead ? (
                  <Button
                    variant="secondary"
                    size="md"
                    leftIcon={<MessageSquare size={16} strokeWidth={1.8} />}
                    onClick={() => setCommandOpen(true)}
                  >
                    Command SegmiQ
                  </Button>
                ) : null}
                {lead ? (
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<FileText size={16} strokeWidth={1.8} />}
                    onClick={() =>
                      router.push(`/sales/quotes?leadId=${lead.id}&dealId=${deal.id}`)
                    }
                  >
                    Create quote
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-sales-border-subtle pt-4 sm:grid-cols-4">
            {metaItems.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[11px] font-medium text-sales-text-muted">{item.label}</p>
                <p className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-sales-text-primary">
                  {item.value}
                </p>
                {item.hint ? (
                  <p
                    className={cn(
                      "mt-0.5 text-[11px]",
                      item.hint === "Overdue"
                        ? "text-sales-danger-fg"
                        : "text-sales-text-muted"
                    )}
                  >
                    {item.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {/* Stage progress */}
          <div className="border-t border-sales-border-subtle pt-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              Stage
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DEAL_ACTIVE_STAGES.map((stage, idx) => {
                const current = deal.stage === stage;
                const done = !closed && activeIdx >= idx;
                return (
                  <button
                    key={stage}
                    type="button"
                    disabled={closed || moving}
                    onClick={() => void moveStage(stage)}
                    className={cn(
                      "min-h-10 shrink-0 rounded-full px-3.5 text-[12px] font-medium transition-colors disabled:opacity-50",
                      current
                        ? "bg-sales-brand text-sales-brand-text shadow-sales-card"
                        : done
                          ? "bg-sales-brand-soft text-sales-text-primary"
                          : "border border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover"
                    )}
                  >
                    {DEAL_STAGE_LABEL[stage]}
                  </button>
                );
              })}
              {!closed ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCloseMode("won")}
                    className="min-h-10 shrink-0 rounded-full border border-sales-border bg-sales-success-soft px-3.5 text-[12px] font-medium text-sales-success-fg"
                  >
                    Won
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloseMode("lost")}
                    className="min-h-10 shrink-0 rounded-full border border-sales-border bg-sales-danger-soft px-3.5 text-[12px] font-medium text-sales-danger-fg"
                  >
                    Lost
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
        {/* Main column */}
        <div className="space-y-4">
          {!closed ? (
            <DealNextBestActionPanel
              deal={deal}
              openQuote={
                currentQuote
                  ? {
                      id: currentQuote.id,
                      status: currentQuote.status,
                      sentAt: currentQuote.sent_at,
                      validUntil: currentQuote.valid_until,
                      approvalStatus: currentQuote.approval_status,
                      customerResponded: Boolean(
                        currentQuote.customer_response_type ||
                          currentQuote.status === "accepted" ||
                          currentQuote.status === "rejected"
                      ),
                    }
                  : null
              }
            />
          ) : null}
          <Card variant={nextAction.isOverdue ? "attention" : "standard"}>
            <CardHeader>
              <CardTitle>Next action</CardTitle>
            </CardHeader>
            <CardContent>
              {nextAction.hasNextAction ? (
                <div>
                  <p className="text-[16px] font-semibold text-sales-text-primary">
                    {nextAction.label || "Follow-up"}
                  </p>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">
                    {nextAction.at
                      ? new Date(nextAction.at).toLocaleString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null}
                    {nextAction.isOverdue ? " · Overdue" : null}
                  </p>
                  {!closed ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() =>
                          void patchDeal({
                            next_action_at: null,
                            next_action_label: null,
                          })
                        }
                      >
                        Complete
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => openDetails("next_action")}
                      >
                        Reschedule
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <p className="text-[13px] text-sales-text-secondary">
                    {nextAction.emptyMessage ||
                      "This active Deal does not have another action scheduled."}
                  </p>
                  {!closed ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => openDetails("next_action")}
                      >
                        Schedule next action
                      </Button>
                      <Link
                        href={`/sales/calendar?deal=${deal.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-sales-md border border-sales-border-strong bg-sales-surface px-4 text-[13px] font-semibold text-sales-text-primary shadow-sales-card transition-colors hover:bg-sales-surface-hover"
                      >
                        Open calendar
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              action={
                !closed && lead && canCreateQuote ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      router.push(`/sales/quotes?leadId=${lead.id}&dealId=${deal.id}`)
                    }
                  >
                    New quotation
                  </Button>
                ) : null
              }
            >
              <CardTitle>Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-[13px] text-sales-text-secondary">
                  No quotation created yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {currentQuote ? (
                    <div className="rounded-sales-lg border border-sales-border bg-sales-surface px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                            Current offer
                          </p>
                          <Link
                            href={quoteHref(currentQuote.id)}
                            className="mt-0.5 block truncate text-[14px] font-semibold text-sales-text-primary hover:underline"
                          >
                            {currentQuote.quote_number || "Quote"} · v{currentQuote.revision_number || 1}
                          </Link>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={quoteStatusTone(currentQuote.status)} appearance="soft">
                              {formatQuoteStatus(currentQuote.status)}
                            </Badge>
                            {currentQuote.approval_status && currentQuote.approval_status !== "not_required" ? (
                              <span className="text-[11px] text-sales-text-muted">
                                Approval {currentQuote.approval_status.replace(/_/g, " ")}
                              </span>
                            ) : null}
                            {currentQuote.viewed_at ? (
                              <span className="text-[11px] text-sales-text-muted">
                                Viewed {new Date(currentQuote.viewed_at).toLocaleDateString()}
                              </span>
                            ) : currentQuote.sent_at ? (
                              <span className="text-[11px] text-sales-text-muted">Sent, not viewed</span>
                            ) : null}
                          </div>
                          {currentQuote.valid_until ? (
                            <p className="mt-1 text-[11px] text-sales-text-muted">
                              Valid until {new Date(`${currentQuote.valid_until}T12:00:00`).toLocaleDateString()}
                            </p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-[14px] font-semibold tabular-nums text-sales-text-primary">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: currentQuote.currency || "USD",
                            maximumFractionDigits: 0,
                          }).format(Number(currentQuote.total) || 0)}
                        </p>
                      </div>
                      {!closed && canCreateQuote && canCreateDealRevision(currentQuote) ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={revising}
                            onClick={() => void createRevision(currentQuote.id)}
                          >
                            Create revision
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {previousQuotes.length > 0 ? (
                    <ul className="space-y-2">
                      {previousQuotes.map((q) => (
                        <li
                          key={q.id}
                          className="flex items-center justify-between gap-3 rounded-sales-lg border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <Link
                              href={quoteHref(q.id)}
                              className="truncate text-[13px] font-medium text-sales-text-primary hover:underline"
                            >
                              {q.quote_number || "Quote"} · v{q.revision_number || 1}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge tone={quoteStatusTone(q.status)} appearance="soft">
                                {formatQuoteStatus(q.status)}
                              </Badge>
                              {q.status === "superseded" ? (
                                <span className="text-[11px] text-sales-text-muted">Superseded</span>
                              ) : null}
                            </div>
                          </div>
                          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-primary">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: q.currency || "USD",
                              maximumFractionDigits: 0,
                            }).format(Number(q.total) || 0)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineItems.length === 0 ? (
                <p className="text-[13px] text-sales-text-secondary">
                  No activity recorded yet.
                </p>
              ) : (
                <Timeline items={timelineItems} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <EntityDocumentsPanel
                clientId={deal.client_id}
                entityType="DEAL"
                entityId={deal.id}
                entityLabel={deal.name}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              action={
                !closed ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => openDetails(null)}
                  >
                    {knownFields.length === 0 ? "Add details" : "Edit"}
                  </Button>
                ) : null
              }
            >
              <CardTitle>What we know</CardTitle>
            </CardHeader>
            <CardContent>
              {knownFields.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-sales-text-secondary">
                    Add discovery details as you learn more — service, timeframe, decision maker,
                    location.
                  </p>
                  {!closed ? (
                    <Button variant="secondary" size="sm" onClick={() => openDetails("service")}>
                      Complete Deal details
                    </Button>
                  ) : null}
                </div>
              ) : (
                <dl className="space-y-3">
                  {knownFields.map((row) => (
                    <div key={row.label}>
                      <dt className="text-[11px] font-medium text-sales-text-muted">
                        {row.label}
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-sales-text-primary">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              action={
                !closed ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => openDetails("value")}
                  >
                    {commercial.kind === "pending" ? "Estimate value" : "Update"}
                  </Button>
                ) : null
              }
            >
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3 text-[13px]">
                <span className="text-sales-text-secondary">Estimated value</span>
                <span className="text-right font-semibold tabular-nums text-sales-text-primary">
                  {commercial.display}
                </span>
              </div>
              {formatDealValueBasis(deal.value_basis) ? (
                <div className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-sales-text-secondary">Basis</span>
                  <span className="font-medium text-sales-text-primary">
                    {formatDealValueBasis(deal.value_basis)}
                  </span>
                </div>
              ) : null}
              {deal.customer_budget != null && deal.customer_budget > 0 ? (
                <div className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-sales-text-secondary">Customer budget</span>
                  <span className="font-medium tabular-nums text-sales-text-primary">
                    ${deal.customer_budget.toLocaleString()}
                  </span>
                </div>
              ) : null}
              {quotes[0] ? (
                <div className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-sales-text-secondary">Latest quotation</span>
                  <span className="text-right font-medium text-sales-text-primary">
                    ${Number(quotes[0].total).toLocaleString()}
                    <span className="ml-1 text-sales-text-muted">
                      · {formatQuoteStatus(quotes[0].status)}
                    </span>
                  </span>
                </div>
              ) : (
                <p className="text-[13px] text-sales-text-secondary">
                  No quotation created yet.
                </p>
              )}
              {deal.expected_decision_at ? (
                <div className="flex items-start justify-between gap-3 text-[13px]">
                  <span className="text-sales-text-secondary">Expected decision</span>
                  <span className="font-medium text-sales-text-primary">
                    {new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ) : !closed ? (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={() => openDetails("expected_decision")}
                >
                  Add expected decision date
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deal information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[12px] text-sales-text-secondary">
                {completeness.summaryLabel}
              </p>
              <ul className="mt-3 space-y-2">
                {completeness.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={closed || item.done}
                      onClick={() => {
                        if (item.id === "value") openDetails("value");
                        else if (item.id === "expected_decision") openDetails("expected_decision");
                        else if (item.id === "next_action") openDetails("next_action");
                        else if (item.id === "decision_maker") openDetails("decision_maker");
                        else openDetails("service");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 text-left text-[12px] text-sales-text-primary",
                        !item.done && !closed
                          ? "cursor-pointer hover:text-sales-brand-fg"
                          : "cursor-default"
                      )}
                    >
                      {item.done ? (
                        <Check className="h-3.5 w-3.5 text-sales-success" strokeWidth={2} />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-sales-text-muted" strokeWidth={1.8} />
                      )}
                      <span className={!item.done && !closed ? "underline-offset-2 hover:underline" : ""}>
                        {item.label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {completeness.nextSuggestion && !closed ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const id = completeness.nextSuggestion?.id;
                    if (id === "value") openDetails("value");
                    else if (id === "expected_decision") openDetails("expected_decision");
                    else if (id === "next_action") openDetails("next_action");
                    else if (id === "decision_maker") openDetails("decision_maker");
                    else openDetails("service");
                  }}
                >
                  {completeness.nextSuggestion.cta}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {lead ? (
            <Card variant="flat">
              <CardContent className="py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
                  Related lead
                </p>
                <p className="mt-1 text-[13px] text-sales-text-secondary">
                  Acquisition history preserved ·{" "}
                  {String(lead.source).replace(/_/g, " ")}
                </p>
                {lead.contact_id ? (
                  <Link
                    href={`/sales/customers/${lead.contact_id}`}
                    className="mt-2 inline-flex text-[12px] font-semibold text-sales-text-primary underline-offset-2 hover:underline"
                  >
                    Open customer
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Close dialog */}
      {closeMode ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
          <div className="sales-modal-premium w-full max-w-md rounded-t-sales-xl bg-sales-surface p-5 shadow-sales-modal sm:rounded-sales-xl">
            <h3 className="text-[16px] font-semibold text-sales-text-primary">
              {closeMode === "won" ? "Mark deal won" : "Mark deal lost"}
            </h3>
            {closeMode === "won" ? (
              <label className="mt-4 block">
                <span className="text-[12px] font-medium text-sales-text-secondary">
                  Final value
                </span>
                <Input
                  className="mt-1.5"
                  value={wonValue}
                  onChange={(e) => setWonValue(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="text-[12px] font-medium text-sales-text-secondary">Reason</p>
                <div className="flex flex-wrap gap-2">
                  {LOST_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLostReason(r)}
                      className={cn(
                        "min-h-10 rounded-full border px-3 text-[12px] font-medium transition-colors",
                        lostReason === r
                          ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                          : "border-sales-border bg-sales-surface text-sales-text-secondary hover:bg-sales-surface-hover"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {closeError ? (
              <p className="mt-3 text-[13px] text-sales-danger-fg" role="alert">
                {closeError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setCloseMode(null)}
              >
                Cancel
              </Button>
              <Button
                variant={closeMode === "won" ? "success" : "danger"}
                size="md"
                className="flex-1"
                disabled={closing}
                onClick={() => void submitClose()}
              >
                {closing ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!closed ? (
        <DealDetailsEditorSheet
          deal={deal}
          open={detailsOpen}
          focus={detailsFocus}
          onClose={() => {
            setDetailsOpen(false);
            setDetailsFocus(null);
            if (searchParams.get("edit")) {
              router.replace(`/sales/deals/${deal.id}`, { scroll: false });
            }
          }}
          onSaved={(updated) => applyDealUpdate(updated)}
        />
      ) : null}

      {lead ? (
        <SalesCommandDrawer
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          customerName={customerName}
          pageContext={{
            leadId: lead.id,
            customerId: lead.contact_id,
            dealId: deal.id,
            conversationId: lead.id,
            ownerId: deal.owner_id,
          }}
        />
      ) : null}
    </div>
  );
}
