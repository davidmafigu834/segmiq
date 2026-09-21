"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy } from "lucide-react";
import { Avatar, Badge, Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { formatMoney } from "@/lib/quotations/totals";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import type {
  AttentionItem,
  ConversationPattern,
  FunnelStageResult,
  PipelineHealthBucket,
  SalespersonNarrative,
  WeeklyReportPayload,
} from "@/lib/sales/weekly-team-report/types";
import { FactObservation, SegmiQAnalysis } from "./SegmiQAnalysis";
import { MetricSummary } from "./MetricSummary";
import { dealHref, findMetric, formatCompactMoney } from "./format";

export function ReportDocument({
  payload,
  onEvidence,
  onCopyAgenda,
}: {
  payload: WeeklyReportPayload;
  onEvidence: (title: string, explanation: string, items: AttentionItem[]) => void;
  onCopyAgenda: () => void;
}) {
  const { cover, ai } = payload;
  return (
    <article className="mx-auto w-full max-w-[44rem] pb-16">
      <header id="overview" className="weekly-report-section border-b border-sales-border-subtle pb-8">
        <p className="text-[12px] font-medium text-sales-text-muted">Prepared by SegmiQ Intelligence</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-sales-text-primary sm:text-[32px]">
          {cover.title}
        </h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">
          {cover.organisationName}
          <span className="mx-2 text-sales-text-muted">/</span>
          {cover.periodLabel}
        </p>
        <p className="mt-1 text-[12px] text-sales-text-muted">Generated {cover.generatedAtLabel}</p>
      </header>

      <section className="weekly-report-section mt-10">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Executive summary</h2>
        {payload.lowData && ai.dataSufficiencyNote ? (
          <p className="mt-3 max-w-[68ch] text-[14px] text-sales-text-muted">{ai.dataSufficiencyNote}</p>
        ) : null}
        <p className="weekly-report-prose mt-4">{ai.executiveSummary}</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Insight label="What went well" value={ai.whatWentWell} />
          <Insight label="Where momentum was lost" value={ai.whereMomentumWasLost} />
          <Insight label="Biggest risk" value={ai.biggestRisk} />
          <Insight label="Priority for next week" value={ai.priorityForNextWeek} />
        </div>
      </section>

      <PerformanceSection payload={payload} />
      <FunnelSection payload={payload} />
      <TeamSection payload={payload} />
      <AttentionSection payload={payload} onEvidence={onEvidence} />
      <PipelineSection payload={payload} onEvidence={onEvidence} />
      <ConversationSection patterns={payload.conversation} />
      <LostSection payload={payload} />
      <RecommendationsSection payload={payload} />
      <NextWeekSection payload={payload} />
      <AgendaSection items={ai.meetingAgenda} onCopy={onCopyAgenda} />
    </article>
  );
}

function funnelDropLabel(funnel: FunnelStageResult[], largest: FunnelStageResult): string {
  const index = funnel.findIndex((stage) => stage.id === largest.id);
  const from = index > 0 ? funnel[index - 1] : null;
  if (!from) return largest.label;
  return `${from.label} → ${largest.label}`;
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-sales-border-subtle pt-3">
      <p className="text-[11px] font-medium text-sales-text-muted">{label}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-sales-text-primary">{value}</p>
    </div>
  );
}

function PerformanceSection({ payload }: { payload: WeeklyReportPayload }) {
  const ids = ["new_leads", "deals_won", "revenue_won", "avg_first_response", "follow_ups_missed", "quotations_sent"];
  const metrics = ids.map((id) => findMetric(payload.metrics, id)).filter(Boolean);
  return (
    <section id="performance" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Team performance</h2>
      <div className="mt-4 grid grid-cols-2 gap-x-6 border-t border-sales-border-subtle sm:grid-cols-3">
        {metrics.map((metric) => (
          <MetricSummary key={metric!.id} metric={metric!} currency={payload.cover.currency} />
        ))}
      </div>
    </section>
  );
}

function FunnelSection({ payload }: { payload: WeeklyReportPayload }) {
  const max = Math.max(...payload.funnel.map((s) => s.count), 1);
  const largest = payload.funnel.slice(1).reduce<FunnelStageResult | null>((best, stage) => {
    if (!best || stage.dropOff > best.dropOff) return stage;
    return best;
  }, null);
  const fact = payload.funnelExplanation.find((row) => row.kind === "fact");
  const observation = payload.funnelExplanation.find((row) => row.kind === "interpretation");
  return (
    <section id="funnel" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Sales funnel</h2>
      <ol className="mt-5 space-y-3">
        {payload.funnel.map((stage, index) => (
          <li key={stage.id}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-sales-text-primary">{stage.label}</span>
              <span className="tabular-nums text-sales-text-secondary">
                {stage.count}
                {index > 0 ? ` · ${stage.conversionPct}% from previous` : ""}
                {stage.dropOff > 0 ? ` · drop-off ${stage.dropOff}` : ""}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sales-surface-subtle">
              <div className="h-full rounded-full bg-sales-text-primary" style={{ width: `${Math.max(6, (stage.count / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
      {largest && largest.dropOff > 0 ? (
        <div className="mt-5 border-l-2 border-sales-warning pl-3">
          <p className="text-[12px] font-medium text-sales-warning-fg">Largest drop-off</p>
          <p className="mt-1 text-[14px] text-sales-text-primary">
            {funnelDropLabel(payload.funnel, largest)}
          </p>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            {largest.dropOff} {largest.dropOff === 1 ? "opportunity" : "opportunities"} did not progress to the next stage.
          </p>
        </div>
      ) : null}
      {fact && observation ? <FactObservation fact={fact.text} observation={observation.text} /> : (
        payload.funnelExplanation.map((row, i) => (
          <p key={i} className="weekly-report-prose mt-3">{row.text}</p>
        ))
      )}
    </section>
  );
}

function TeamSection({ payload }: { payload: WeeklyReportPayload }) {
  const people = payload.salespeople;
  const leads = findMetric(payload.metrics, "new_leads");
  const wins = findMetric(payload.metrics, "deals_won");
  const revenue = findMetric(payload.metrics, "revenue_won");
  return (
    <section id="team" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Sales team</h2>
      <p className="mt-2 text-[13px] text-sales-text-muted">
        {people.length} {people.length === 1 ? "salesperson" : "salespeople"}
        {leads?.current != null ? ` · ${leads.current} leads` : ""}
        {wins?.current != null ? ` · ${wins.current} wins` : ""}
        {revenue?.current != null ? ` · ${formatCompactMoney(revenue.current, payload.cover.currency)}` : ""}
      </p>
      {people.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">No salespeople were in this organisation's team for the week.</p>
      ) : (
        <div className="mt-5 divide-y divide-sales-border-subtle border-t border-sales-border-subtle">
          {people.map((person) => (
            <SalespersonRow key={person.salespersonId} person={person} currency={payload.cover.currency} />
          ))}
        </div>
      )}
    </section>
  );
}

function SalespersonRow({ person, currency }: { person: SalespersonNarrative; currency: string }) {
  const [open, setOpen] = useState(false);
  const leads = findMetric(person.metrics, "leads_assigned");
  const quotes = findMetric(person.metrics, "quotations_sent");
  const wins = findMetric(person.metrics, "deals_won");
  const revenue = findMetric(person.metrics, "revenue_won");
  const response = findMetric(person.metrics, "avg_response");
  return (
    <article className="py-4">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar name={person.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sales-text-primary">
            {person.name}
            {person.active ? "" : <span className="ml-2 text-[12px] font-normal text-sales-text-muted">Inactive</span>}
          </p>
          <p className="mt-1 text-[12px] tabular-nums text-sales-text-muted">
            {[
              leads ? `${leads.current ?? 0} leads` : null,
              quotes ? `${quotes.current ?? 0} quotes` : null,
              wins ? `${wins.current ?? 0} wins` : null,
              revenue ? formatCompactMoney(revenue.current, currency) : null,
              response?.current != null ? `${Math.round(response.current)}m response` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn("mt-1 shrink-0 text-sales-text-muted transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-3 max-w-[68ch] pl-11">
          <p className="text-[14px] leading-relaxed text-sales-text-secondary">{person.narrative}</p>
          {person.strengths[0] ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">
              <span className="font-medium text-sales-text-primary">Strengths. </span>
              {person.strengths.join(" ")}
            </p>
          ) : null}
          {person.concerns[0] ? (
            <p className="mt-2 text-[13px] text-sales-text-secondary">
              <span className="font-medium text-sales-text-primary">Watch. </span>
              {person.concerns.join(" ")}
            </p>
          ) : null}
          <p className="mt-3 text-[12px] text-sales-text-muted">
            Coaching focus: <span className="font-medium text-sales-text-primary">{person.coachingFocus}</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 pl-11 text-[12px] text-sales-text-muted">Coaching focus: {person.coachingFocus}</p>
      )}
    </article>
  );
}

function AttentionSection({
  payload,
  onEvidence,
}: {
  payload: WeeklyReportPayload;
  onEvidence: (title: string, explanation: string, items: AttentionItem[]) => void;
}) {
  return (
    <section id="attention" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Needs your attention</h2>
      <p className="mt-2 max-w-[68ch] text-[14px] text-sales-text-secondary">
        High-value or stalled opportunities SegmiQ believes management should review.
      </p>
      {payload.attention.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">
          No major opportunities require management attention this week.
        </p>
      ) : (
        <ul className="mt-5 space-y-6">
          {payload.attention.map((item) => (
            <li key={item.id} className="border-t border-sales-border-subtle pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-sales-text-primary">{item.displayName}</h3>
                <Severity item={item} />
              </div>
              <p className="mt-1 text-[12px] text-sales-text-muted">
                {item.salespersonName ?? "Unassigned"}
                {item.value != null ? ` · ${formatMoney(item.value, payload.cover.currency)}` : ""}
                {` · ${item.stageLabel}`}
                {item.daysInactive != null ? ` · ${item.daysInactive}d inactive` : ""}
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-sales-text-secondary">{item.reason}</p>
              <p className="mt-2 text-[13px] text-sales-text-primary">Recommended: {item.recommendedAction}</p>
              {item.entityKind === "deal" ? (
                <Link
                  href={dealHref(item.entityId)}
                  className={cn(salesMenuTriggerClass({ variant: "secondary", size: "sm" }), "mt-3")}
                >
                  Open deal
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {payload.attention.length > 0 ? (
        <button
          type="button"
          className="mt-4 text-[12px] font-medium text-sales-text-muted hover:text-sales-text-primary"
          onClick={() =>
            onEvidence(
              "Opportunities requiring review",
              "These records were flagged from inactivity, missing quotation follow-up, or unanswered customer replies.",
              payload.attention
            )
          }
        >
          View evidence
        </button>
      ) : null}
    </section>
  );
}

function Severity({ item }: { item: AttentionItem }) {
  const critical =
    /replied|waiting|has not received a response/i.test(item.reason) ||
    (item.daysInactive != null && item.daysInactive >= 8);
  const atRisk =
    /quotation|follow-up|stalled/i.test(item.reason) || (item.daysInactive != null && item.daysInactive >= 5);
  const label = critical ? "Critical" : atRisk ? "At risk" : "Needs attention";
  return (
    <Badge tone={critical ? "danger" : atRisk ? "warning" : "neutral"} appearance="outline" size="sm">
      {label}
    </Badge>
  );
}

function PipelineSection({
  payload,
  onEvidence,
}: {
  payload: WeeklyReportPayload;
  onEvidence: (title: string, explanation: string, items: AttentionItem[]) => void;
}) {
  const total = payload.pipelineHealth.reduce((sum, bucket) => sum + bucket.value, 0);
  const atRisk = payload.pipelineHealth.filter((b) => b.id === "at_risk" || b.id === "stalled" || b.id === "quoted_awaiting_followup");
  return (
    <section id="pipeline" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Pipeline health</h2>
      <p className="mt-2 text-[18px] font-semibold tabular-nums text-sales-text-primary">
        {formatMoney(total, payload.cover.currency)} active pipeline
      </p>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sales-surface-subtle">
        {payload.pipelineHealth.map((bucket) => (
          <div
            key={bucket.id}
            title={`${bucket.label}: ${bucket.pct}%`}
            className={cn(
              "h-full",
              bucket.id === "healthy" && "bg-sales-text-primary",
              bucket.id === "needs_attention" && "bg-sales-warning",
              (bucket.id === "at_risk" || bucket.id === "stalled") && "bg-sales-danger/70",
              bucket.id === "quoted_awaiting_followup" && "bg-sales-brand"
            )}
            style={{ width: `${Math.max(bucket.pct, bucket.count > 0 ? 3 : 0)}%` }}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {payload.pipelineHealth.map((bucket: PipelineHealthBucket) => (
          <li key={bucket.id} className="text-[13px] text-sales-text-secondary">
            <span className="font-medium text-sales-text-primary">{bucket.label}</span>
            {" · "}
            {bucket.count} · {formatCompactMoney(bucket.value, payload.cover.currency)}
          </li>
        ))}
      </ul>
      {payload.pipelineHealthNarrative ? (
        <SegmiQAnalysis
          how="Classification uses last meaningful activity, quotation follow-up windows, and stage duration thresholds configured for this organisation."
        >
          {payload.pipelineHealthNarrative}
        </SegmiQAnalysis>
      ) : null}
      {atRisk.some((b) => b.count > 0) ? (
        <button
          type="button"
          className="mt-3 text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
          onClick={() =>
            onEvidence(
              "At-risk pipeline",
              "Opportunities currently classified as at risk, stalled, or quoted without follow-up.",
              payload.attention.filter(
                (item) =>
                  (item.daysInactive != null && item.daysInactive >= 5) ||
                  /quotation|follow-up|stalled/i.test(item.reason)
              )
            )
          }
        >
          View at-risk deals
        </button>
      ) : null}
    </section>
  );
}

function ConversationSection({ patterns }: { patterns: ConversationPattern[] }) {
  return (
    <section id="conversations" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">
        What customers are telling your team
      </h2>
      {patterns.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">
          No recurring conversation patterns were identified from authorised inbound messages.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-sales-border-subtle border-t border-sales-border-subtle">
          {patterns.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-sales-text-primary">{row.label}</p>
                <p className="text-[12px] tabular-nums text-sales-text-muted">{row.count} conversations</p>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-sales-text-secondary">{row.interpretation}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LostSection({ payload }: { payload: WeeklyReportPayload }) {
  const max = Math.max(...payload.lostDeals.reasonCounts.map((r) => r.count), 1);
  return (
    <section id="lost" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Lost deals</h2>
      {payload.lostDeals.count === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">No opportunities were marked lost this week.</p>
      ) : (
        <>
          <p className="mt-3 text-[15px] text-sales-text-primary">
            {payload.lostDeals.count} lost · {formatMoney(payload.lostDeals.value, payload.cover.currency)} potential revenue
          </p>
          <ul className="mt-4 space-y-2">
            {payload.lostDeals.reasonCounts.map((row) => (
              <li key={row.reason}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-sales-text-primary">{row.reason}</span>
                  <span className="tabular-nums text-sales-text-muted">{row.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sales-surface-subtle">
                  <div className="h-full bg-sales-text-secondary" style={{ width: `${(row.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {payload.lostDeals.narrative ? (
            <SegmiQAnalysis how="Loss reasons come from recorded outcome fields. Missing reasons are shown as Reason not recorded.">
              {payload.lostDeals.narrative}
            </SegmiQAnalysis>
          ) : null}
        </>
      )}
    </section>
  );
}

function RecommendationsSection({ payload }: { payload: WeeklyReportPayload }) {
  const rows = payload.ai.managerRecommendations;
  return (
    <section id="recommendations" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Recommended actions</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">No additional management actions were required from this week's data.</p>
      ) : (
        <ol className="mt-5 space-y-6">
          {rows.map((row, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3">
              <span className="text-[13px] tabular-nums text-sales-text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-[15px] font-semibold text-sales-text-primary">{row.title}</h3>
                <p className="mt-2 text-[13px] text-sales-text-secondary"><span className="font-medium text-sales-text-primary">Evidence. </span>{row.evidence}</p>
                <p className="mt-1 text-[13px] text-sales-text-secondary"><span className="font-medium text-sales-text-primary">Recommended action. </span>{row.action}</p>
                <p className="mt-1 text-[13px] text-sales-text-muted"><span className="font-medium">Objective. </span>{row.objective}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NextWeekSection({ payload }: { payload: WeeklyReportPayload }) {
  const rows = payload.ai.nextWeekPriorities;
  return (
    <section id="next-week" className="weekly-report-section mt-12">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Priorities for next week</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">Keep the current operating cadence and review high-value pipeline in the weekly meeting.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {rows.map((row, i) => (
            <li key={i} className="border-t border-sales-border-subtle pt-3">
              <p className="text-[15px] font-semibold text-sales-text-primary">
                <span className="mr-2 text-[12px] font-medium text-sales-text-muted">{String(i + 1).padStart(2, "0")}</span>
                {row.title}
              </p>
              <p className="mt-1 text-[13px] text-sales-text-secondary">
                {row.affectedCount} items
                {row.pipelineValue != null ? ` · ${formatCompactMoney(row.pipelineValue, payload.cover.currency)}` : ""}
                {` · ${row.ownerLabel}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AgendaSection({
  items,
  onCopy,
}: {
  items: string[];
  onCopy: () => void;
}) {
  return (
    <section id="agenda" className="weekly-report-section mt-12">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-sales-text-primary">Suggested sales meeting agenda</h2>
        {items.length > 0 ? (
          <Button size="sm" variant="ghost" leftIcon={<Copy size={14} />} onClick={onCopy}>
            Copy agenda
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[14px] text-sales-text-secondary">No agenda items were generated for this week.</p>
      ) : (
        <ol className="mt-5 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sales-text-secondary">
              <span className="w-6 shrink-0 tabular-nums text-sales-text-muted">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
