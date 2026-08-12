"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Circle,
  MessageCircle,
  MoreHorizontal,
  Phone,
  FileText,
} from "lucide-react";
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

type NextActionState = {
  hasNextAction: boolean;
  isOverdue: boolean;
  label: string | null;
  at: string | null;
  emptyMessage: string;
};

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
  const [moreOpen, setMoreOpen] = useState(false);
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
    } else if (
      deal.estimated_value_min != null &&
      deal.estimated_value_max != null
    ) {
      rows.push({
        label: "Budget",
        value: `$${deal.estimated_value_min}–$${deal.estimated_value_max}`,
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
    await patchDeal({
      expected_decision_at: decisionDraft || null,
    });
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

  const fieldClass =
    "mt-1 min-h-[44px] w-full rounded-[10px] border border-[#E4E7EC] bg-white px-3 text-[14px] text-[#101828] outline-none focus:border-[#D4FF4F] dark:border-[#272C27] dark:bg-[#111411] dark:text-[#F7F8F5]";

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#101828] dark:bg-[#0B0D0C] dark:text-[#F7F8F5]">
      <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 layout:pb-10">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/sales/leads"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-medium text-[#667085] hover:bg-white dark:text-[#B1B7AE] dark:hover:bg-[#151815]"
          >
            <ArrowLeft className="h-4 w-4" />
            Pipeline
          </Link>
        </div>

        {/* Header */}
        <header className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411] layout:p-5">
          <div className="flex flex-col gap-3 layout:flex-row layout:items-start layout:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-wide text-[#667085] dark:text-[#B1B7AE]">
                {customerName}
              </p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{deal.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[12px] font-medium text-[#344054] dark:bg-[#151815] dark:text-[#B1B7AE]">
                  {formatDealStage(deal.stage)}
                </span>
                {lead?.score != null ? (
                  <span className="text-[12px] text-[#667085] dark:text-[#B1B7AE]">
                    Origin intent {lead.score}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm layout:text-right">
              <div>
                <p className="text-[11px] text-[#667085] dark:text-[#B1B7AE]">Estimated value</p>
                <p className="font-semibold">{commercial.display}</p>
                {commercial.kind !== "pending" ? (
                  <p className="text-[11px] text-[#98A2B3]">
                    {formatDealValueBasis(commercial.basis)}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[11px] text-[#667085] dark:text-[#B1B7AE]">Expected decision</p>
                <p className="font-semibold">
                  {deal.expected_decision_at
                    ? new Date(deal.expected_decision_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#667085] dark:text-[#B1B7AE]">Last contact</p>
                <p className="font-semibold">
                  {deal.last_meaningful_activity_at
                    ? timeAgo(deal.last_meaningful_activity_at)
                    : timeAgo(deal.updated_at)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#667085] dark:text-[#B1B7AE]">Next action</p>
                <p className="font-semibold">
                  {nextAction.hasNextAction
                    ? nextAction.label || "Scheduled"
                    : "None"}
                </p>
              </div>
            </div>
          </div>

          {/* Stage progress */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {DEAL_ACTIVE_STAGES.map((stage, idx) => {
              const activeIdx = DEAL_ACTIVE_STAGES.indexOf(
                deal.stage as (typeof DEAL_ACTIVE_STAGES)[number]
              );
              const done = !closed && activeIdx >= idx;
              const current = deal.stage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  disabled={closed || moving}
                  onClick={() => void moveStage(stage)}
                  className={`min-h-[40px] shrink-0 rounded-full px-3 text-[12px] font-medium ${
                    current
                      ? "bg-[#101828] text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
                      : done
                        ? "bg-[rgba(212,255,79,0.2)] text-[#101828] dark:text-[#F7F8F5]"
                        : "border border-[#E4E7EC] text-[#667085] dark:border-[#272C27] dark:text-[#B1B7AE]"
                  }`}
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
                  className="min-h-[40px] shrink-0 rounded-full border border-[#E4E7EC] px-3 text-[12px] font-medium text-[#027A48] dark:border-[#272C27]"
                >
                  Won
                </button>
                <button
                  type="button"
                  onClick={() => setCloseMode("lost")}
                  className="min-h-[40px] shrink-0 rounded-full border border-[#E4E7EC] px-3 text-[12px] font-medium text-[#B42318] dark:border-[#272C27]"
                >
                  Lost
                </button>
              </>
            ) : null}
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          {/* Left column */}
          <div className="space-y-4">
            {/* Next action */}
            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <h2 className="text-[13px] font-semibold">Next action</h2>
              {nextAction.hasNextAction ? (
                <div className="mt-2">
                  <p className="text-[16px] font-semibold">
                    {nextAction.label || "Follow-up"}
                  </p>
                  <p className="text-[13px] text-[#667085] dark:text-[#B1B7AE]">
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-[44px] rounded-[10px] bg-[#101828] px-4 text-[13px] font-semibold text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
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
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[13px] text-[#667085] dark:text-[#B1B7AE]">
                    {nextAction.emptyMessage ||
                      "This active Deal does not have another action scheduled."}
                  </p>
                  {!closed ? (
                    <Link
                      href={`/sales/calendar?deal=${deal.id}`}
                      className="mt-3 inline-flex min-h-[44px] items-center rounded-[10px] border border-[#E4E7EC] px-4 text-[13px] font-medium dark:border-[#272C27]"
                    >
                      Schedule follow-up
                    </Link>
                  ) : null}
                </div>
              )}
            </section>

            {/* Quotes */}
            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold">Quotations</h2>
                {!closed && lead ? (
                  <Link
                    href={`/sales/quotes?leadId=${lead.id}&dealId=${deal.id}`}
                    className="text-[12px] font-semibold text-[#101828] dark:text-[#D4FF4F]"
                  >
                    Create quote
                  </Link>
                ) : null}
              </div>
              {quotes.length === 0 ? (
                <p className="mt-2 text-[13px] text-[#667085] dark:text-[#B1B7AE]">
                  No quotation created yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {quotes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between rounded-[12px] border border-[#E4E7EC] px-3 py-2.5 dark:border-[#272C27]"
                    >
                      <div>
                        <p className="text-[13px] font-medium">
                          {q.quote_number || "Quote"}
                        </p>
                        <p className="text-[12px] capitalize text-[#667085] dark:text-[#B1B7AE]">
                          {q.status}
                        </p>
                      </div>
                      <p className="text-[13px] font-semibold">
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
            </section>

            {/* Timeline */}
            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <h2 className="text-[13px] font-semibold">Timeline</h2>
              <ol className="mt-3 space-y-3">
                {timeline.slice(0, 40).map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D4FF4F]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{ev.label}</p>
                      {ev.detail ? (
                        <p className="text-[12px] text-[#667085] dark:text-[#B1B7AE]">
                          {ev.detail}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-[#98A2B3]">
                        {new Date(ev.at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <h2 className="text-[13px] font-semibold">What we know</h2>
              {knownFields.length === 0 ? (
                <p className="mt-2 text-[13px] text-[#667085] dark:text-[#B1B7AE]">
                  No Deal yet details captured — add discovery as you learn more.
                </p>
              ) : (
                <dl className="mt-3 space-y-2">
                  {knownFields.map((row) => (
                    <div key={row.label}>
                      <dt className="text-[11px] text-[#667085] dark:text-[#B1B7AE]">
                        {row.label}
                      </dt>
                      <dd className="text-[13px] font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <h2 className="text-[13px] font-semibold">Commercial</h2>
              <div className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span className="text-[#667085] dark:text-[#B1B7AE]">Estimated value</span>
                  <span className="font-medium">{commercial.display}</span>
                </div>
                {deal.customer_budget != null && deal.customer_budget > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[#667085] dark:text-[#B1B7AE]">Customer budget</span>
                    <span className="font-medium">
                      ${deal.customer_budget.toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {quotes[0] ? (
                  <div className="flex justify-between gap-2">
                    <span className="text-[#667085] dark:text-[#B1B7AE]">Latest quotation</span>
                    <span className="font-medium">
                      ${Number(quotes[0].total).toLocaleString()} · {quotes[0].status}
                    </span>
                  </div>
                ) : (
                  <p className="text-[#667085] dark:text-[#B1B7AE]">No quotation created yet.</p>
                )}
              </div>
              {!closed ? (
                <div className="mt-3 space-y-2">
                  {editingValue ? (
                    <div className="space-y-2">
                      <input
                        className={fieldClass}
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        placeholder="e.g. 6500"
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        onClick={() => void saveValue()}
                        className="min-h-[40px] rounded-[10px] bg-[#101828] px-3 text-[12px] font-semibold text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
                      >
                        Save value
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setValueDraft(
                          commercial.kind === "amount" ? String(commercial.amount) : ""
                        );
                        setEditingValue(true);
                      }}
                      className="text-[12px] font-semibold text-[#101828] dark:text-[#D4FF4F]"
                    >
                      {commercial.kind === "pending"
                        ? "Estimate deal value"
                        : "Update value"}
                    </button>
                  )}
                  {editingDecision ? (
                    <div className="space-y-2">
                      <input
                        type="date"
                        className={fieldClass}
                        value={decisionDraft}
                        onChange={(e) => setDecisionDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => void saveDecision()}
                        className="min-h-[40px] rounded-[10px] bg-[#101828] px-3 text-[12px] font-semibold text-white dark:bg-[#D4FF4F] dark:text-[#101828]"
                      >
                        Save date
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingDecision(true)}
                      className="block text-[12px] font-semibold text-[#101828] dark:text-[#D4FF4F]"
                    >
                      {deal.expected_decision_at
                        ? "Change expected decision"
                        : "Add expected decision date"}
                    </button>
                  )}
                </div>
              ) : null}
            </section>

            <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
              <h2 className="text-[13px] font-semibold">Deal information</h2>
              <p className="mt-1 text-[12px] text-[#667085] dark:text-[#B1B7AE]">
                {completeness.summaryLabel}
              </p>
              <ul className="mt-3 space-y-1.5">
                {completeness.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-[12px]">
                    {item.done ? (
                      <Check className="h-3.5 w-3.5 text-[#027A48]" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-[#98A2B3]" />
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>

            {lead ? (
              <section className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 dark:border-[#272C27] dark:bg-[#111411]">
                <h2 className="text-[13px] font-semibold">Related lead</h2>
                <p className="mt-1 text-[13px] text-[#667085] dark:text-[#B1B7AE]">
                  Acquisition history preserved · {lead.source.replace(/_/g, " ")}
                </p>
                {lead.contact_id ? (
                  <Link
                    href={`/sales/customers/${lead.contact_id}`}
                    className="mt-2 inline-block text-[12px] font-semibold text-[#101828] dark:text-[#D4FF4F]"
                  >
                    Open customer
                  </Link>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile action bar */}
      {!closed ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E4E7EC] bg-white/95 px-3 py-2 backdrop-blur dark:border-[#272C27] dark:bg-[#111411]/95 layout:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            <button
              type="button"
              onClick={callCustomer}
              className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] font-medium"
            >
              <Phone className="h-4 w-4" />
              Call
            </button>
            <button
              type="button"
              onClick={whatsappCustomer}
              className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] font-medium"
            >
              <SiWhatsapp className="h-4 w-4" style={{ color: "#25D366" }} />
              WhatsApp
            </button>
            {lead ? (
              <Link
                href={`/sales/quotes?leadId=${lead.id}&dealId=${deal.id}`}
                className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] font-medium"
              >
                <FileText className="h-4 w-4" />
                Quote
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11px] font-medium"
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </button>
          </div>
          {moreOpen ? (
            <div className="mx-auto mt-2 max-w-lg space-y-1 rounded-[12px] border border-[#E4E7EC] bg-white p-2 dark:border-[#272C27] dark:bg-[#151815]">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 rounded-[8px] px-3 text-[13px]"
                onClick={() => {
                  setCloseMode("won");
                  setMoreOpen(false);
                }}
              >
                Mark won
              </button>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 rounded-[8px] px-3 text-[13px]"
                onClick={() => {
                  setCloseMode("lost");
                  setMoreOpen(false);
                }}
              >
                Mark lost
              </button>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center gap-2 rounded-[8px] px-3 text-[13px]"
                onClick={() => {
                  document.getElementById("log-area")?.scrollIntoView();
                  setMoreOpen(false);
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Log activity
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Close dialog */}
      {closeMode ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-[18px] bg-white p-4 dark:bg-[#111411] sm:rounded-[18px]">
            <h3 className="text-[16px] font-semibold">
              {closeMode === "won" ? "Mark deal won" : "Mark deal lost"}
            </h3>
            {closeMode === "won" ? (
              <label className="mt-3 block text-[12px] font-medium text-[#667085]">
                Final value
                <input
                  className={fieldClass}
                  value={wonValue}
                  onChange={(e) => setWonValue(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-[12px] font-medium text-[#667085]">Reason</p>
                <div className="flex flex-wrap gap-2">
                  {LOST_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLostReason(r)}
                      className={`min-h-[40px] rounded-full border px-3 text-[12px] ${
                        lostReason === r
                          ? "border-[#101828] bg-[#F2F4F7] font-semibold dark:border-[#D4FF4F]"
                          : "border-[#E4E7EC] dark:border-[#272C27]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {closeError ? (
              <p className="mt-2 text-[13px] text-[#B42318]" role="alert">
                {closeError}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCloseMode(null)}
                className="min-h-[44px] flex-1 rounded-[10px] border border-[#E4E7EC] text-[13px] font-medium dark:border-[#272C27]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closing}
                onClick={() => void submitClose()}
                className="min-h-[44px] flex-1 rounded-[10px] bg-[#101828] text-[13px] font-semibold text-white disabled:opacity-50 dark:bg-[#D4FF4F] dark:text-[#101828]"
              >
                {closing ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
