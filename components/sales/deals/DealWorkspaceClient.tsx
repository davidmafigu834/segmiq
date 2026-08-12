"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Circle, FileText, Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { DealRow, LeadRow, QuotationRow } from "@/types";
import type { DealCommercialValue } from "@/lib/sales/deals/commercial-value";
import type { DealCompletenessResult } from "@/lib/sales/deals/completeness";
import type { DealTimelineItem } from "@/lib/sales/deals/timeline";
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
}) {
  const router = useRouter();
  const [deal, setDeal] = useState(initialDeal);
  const [quotes] = useState(initialQuotes);
  const [commercial, setCommercial] = useState(initialCommercial);
  const [completeness] = useState(initialCompleteness);
  const [nextAction, setNextAction] = useState(initialNext);
  const [moving, setMoving] = useState(false);
  const [closeMode, setCloseMode] = useState<"won" | "lost" | null>(openClose);
  const [wonValue, setWonValue] = useState(() =>
    commercial.kind === "amount" ? String(commercial.amount) : ""
  );
  const [lostReason, setLostReason] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [valueDraft, setValueDraft] = useState("");
  const [editingValue, setEditingValue] = useState(false);
  const [decisionDraft, setDecisionDraft] = useState(deal.expected_decision_at ?? "");
  const [editingDecision, setEditingDecision] = useState(false);

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
    setDeal(json.deal);
    router.refresh();
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
        const updated = await patchDeal({
          close: { outcome: "WON", wonValue: n },
        });
        setCommercial({
          kind: "amount",
          amount: n,
          basis: "WON_VALUE",
          label: "Won value",
          display: new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(n),
        });
        setDeal(updated);
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
      router.refresh();
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : "Could not close deal.");
    } finally {
      setClosing(false);
    }
  }

  async function saveValue() {
    const n = Number(String(valueDraft).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      await patchDeal({
        value_status: "PENDING_ESTIMATE",
        sales_estimate: null,
        estimated_value: null,
        value_basis: null,
      });
    } else {
      await patchDeal({
        value_status: "KNOWN",
        sales_estimate: n,
        estimated_value: n,
        value_basis: "SALES_ESTIMATE",
      });
      setCommercial({
        kind: "amount",
        amount: n,
        basis: "SALES_ESTIMATE",
        label: "Sales estimate",
        display: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n),
      });
    }
    setEditingValue(false);
  }

  async function saveDecision() {
    await patchDeal({ expected_decision_at: decisionDraft || null });
    setEditingDecision(false);
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
          href="/sales/pipeline"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-sales-md px-2 text-[13px] font-medium text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          Back to pipeline
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
                    <div className="mt-4">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() =>
                          void patchDeal({
                            next_action_at: null,
                            next_action_label: null,
                          }).then(() =>
                            setNextAction({
                              hasNextAction: false,
                              isOverdue: false,
                              label: null,
                              at: null,
                              emptyMessage:
                                "This active Deal does not have another action scheduled.",
                            })
                          )
                        }
                      >
                        Complete
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
                    <div className="mt-4">
                      <Link
                        href={`/sales/calendar?deal=${deal.id}`}
                        className="inline-flex min-h-11 items-center justify-center rounded-sales-md border border-sales-border-strong bg-sales-surface px-4 text-[13px] font-semibold text-sales-text-primary shadow-sales-card transition-colors hover:bg-sales-surface-hover"
                      >
                        Schedule follow-up
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
                !closed && lead ? (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      router.push(`/sales/quotes?leadId=${lead.id}&dealId=${deal.id}`)
                    }
                  >
                    Create quote
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
                <ul className="space-y-2">
                  {quotes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-3 rounded-sales-lg border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-sales-text-primary">
                          {q.quote_number || "Quote"}
                        </p>
                        <Badge
                          tone={quoteStatusTone(q.status)}
                          appearance="soft"
                          className="mt-1"
                        >
                          {formatQuoteStatus(q.status)}
                        </Badge>
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
              <CardTitle>What we know</CardTitle>
            </CardHeader>
            <CardContent>
              {knownFields.length === 0 ? (
                <p className="text-[13px] text-sales-text-secondary">
                  Add discovery details as you learn more.
                </p>
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
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3 text-[13px]">
                <span className="text-sales-text-secondary">Estimated value</span>
                <span className="text-right font-semibold tabular-nums text-sales-text-primary">
                  {commercial.display}
                </span>
              </div>
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

              {!closed ? (
                <div className="space-y-3 border-t border-sales-border-subtle pt-3">
                  {editingValue ? (
                    <div className="space-y-2">
                      <Input
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        placeholder="e.g. 6500"
                        inputMode="decimal"
                        aria-label="Estimated deal value"
                      />
                      <Button variant="primary" size="sm" onClick={() => void saveValue()}>
                        Save value
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => {
                        setValueDraft(
                          commercial.kind === "amount" ? String(commercial.amount) : ""
                        );
                        setEditingValue(true);
                      }}
                    >
                      {commercial.kind === "pending"
                        ? "Estimate deal value"
                        : "Update value"}
                    </Button>
                  )}

                  {editingDecision ? (
                    <div className="space-y-2">
                      <Input
                        type="date"
                        value={decisionDraft}
                        onChange={(e) => setDecisionDraft(e.target.value)}
                        aria-label="Expected decision date"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void saveDecision()}
                      >
                        Save date
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      onClick={() => setEditingDecision(true)}
                    >
                      {deal.expected_decision_at
                        ? "Change expected decision"
                        : "Add expected decision date"}
                    </Button>
                  )}
                </div>
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
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-[12px] text-sales-text-primary"
                  >
                    {item.done ? (
                      <Check className="h-3.5 w-3.5 text-sales-success" strokeWidth={2} />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-sales-text-muted" strokeWidth={1.8} />
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
              {completeness.nextSuggestion ? (
                <p className="mt-3 text-[12px] font-medium text-sales-text-secondary">
                  {completeness.nextSuggestion.cta}
                </p>
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
    </div>
  );
}
