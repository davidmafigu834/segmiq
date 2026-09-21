import { DEAL_STAGE_LABEL, formatDealStage } from "@/lib/sales/deals/display";
import { formatPeriodLabel, dayPartLabel } from "./period";
import { comparedMetric, teamMetrics } from "./metrics";
import { LOW_ACTIVITY_THRESHOLD, MAX_ATTENTION_ITEMS } from "./config";
import { CONVERSATION_PATTERN_DEFS } from "./conversation";
import {
  conversationInterpretation,
  conversationReliability,
  countLabel,
  sanitizePdfText,
} from "./presentation";
import type {
  AttentionItem,
  AttentionPriorityTag,
  ConversationPattern,
  EvidenceRef,
  FunnelStageResult,
  PipelineHealthBucket,
  PipelineHealthBucketId,
  SalespersonNarrative,
  SnapshotDeal,
  TaggedInsight,
  WeeklyReportAiOutput,
  WeeklyReportCover,
  WeeklyReportPayload,
  WeeklyTeamSnapshot,
} from "./types";

function daysBetween(iso: string | null, endIso: string): number | null {
  if (!iso) return null;
  const ms = new Date(endIso).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function hoursBetween(iso: string | null, endIso: string): number | null {
  if (!iso) return null;
  const ms = new Date(endIso).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, ms / 3_600_000);
}

function personName(snapshot: WeeklyTeamSnapshot, id: string | null): string {
  if (!id) return "Unassigned";
  return snapshot.salespeople.find((p) => p.id === id)?.name ?? "Former team member";
}

export function classifyDeal(
  deal: SnapshotDeal,
  snapshot: WeeklyTeamSnapshot
): PipelineHealthBucketId {
  const cfg = snapshot.health;
  const asOf = snapshot.period.endIsoExclusive;
  const inactiveHours = hoursBetween(deal.lastActivityAt, asOf);
  const inactiveDays = inactiveHours == null ? null : inactiveHours / 24;
  const stageHours = cfg.stalledHoursByStage[deal.stage];
  const createdHours = hoursBetween(deal.createdAt, asOf) ?? 0;

  if (deal.hasOpenQuote && !deal.quoteFollowedUp) {
    const quoteAge = hoursBetween(deal.quoteSentAt, asOf);
    if (quoteAge != null && quoteAge >= cfg.quoteFollowupHours) {
      return "quoted_awaiting_followup";
    }
  }
  if (typeof stageHours === "number" && createdHours >= stageHours && (inactiveHours ?? 0) >= stageHours) {
    return "stalled";
  }
  if (inactiveDays != null && inactiveDays >= cfg.atRiskDays) return "at_risk";
  if (inactiveDays != null && inactiveDays >= cfg.needsAttentionDays) return "needs_attention";
  if (deal.lastActivityAt && deal.nextActionAt) return "healthy";
  if (!deal.nextActionAt && (inactiveDays == null || inactiveDays < cfg.needsAttentionDays)) {
    return "needs_attention";
  }
  return "healthy";
}

export function buildFunnel(snapshot: WeeklyTeamSnapshot): FunnelStageResult[] {
  const c = snapshot.current;
  const sequential: Array<{ id: string; label: string; count: number }> = [
    { id: "new_leads", label: "New Leads", count: c.newLeads },
    { id: "contacted", label: "Contacted", count: c.contactedLeads },
    { id: "qualified", label: "Qualified", count: c.qualifiedLeads },
    { id: "quotation", label: "Quotation", count: c.quotationsSent },
  ];
  const mapped = sequential.map((stage, i) => {
    const prev = i === 0 ? stage.count : sequential[i - 1]!.count;
    const conversionPct = prev <= 0 ? (stage.count > 0 ? 100 : 0) : Math.round((stage.count / prev) * 1000) / 10;
    const dropOff = Math.max(0, prev - stage.count);
    return {
      ...stage,
      conversionPct,
      dropOff,
      sequential: true,
      note: null as string | null,
      bottleneck: false,
    };
  });

  let bottleneckId: string | null = null;
  let bestDrop = 0;
  for (const row of mapped.slice(1)) {
    if (row.dropOff > bestDrop) {
      bestDrop = row.dropOff;
      bottleneckId = row.id;
    }
  }

  const wonNote =
    c.dealsWon <= 0
      ? null
      : c.quotationsSent <= 0
        ? "Won during reporting period, without a recorded quotation this week."
        : "Won during reporting period. Wins may include opportunities quoted in earlier weeks.";

  mapped.push({
    id: "won",
    label: "Won",
    count: c.dealsWon,
    conversionPct: 0,
    dropOff: 0,
    sequential: false,
    note: wonNote,
    bottleneck: false,
  });

  return mapped.map((stage) => ({ ...stage, bottleneck: stage.id === bottleneckId && bestDrop > 0 }));
}

export function largestFunnelDropOff(funnel: FunnelStageResult[]): FunnelStageResult | null {
  let best: FunnelStageResult | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const row = funnel[i]!;
    if (!row.sequential) continue;
    if (!best || row.dropOff > best.dropOff) best = row;
  }
  return best;
}

export function funnelDropNarrative(funnel: FunnelStageResult[]): string | null {
  const drop = largestFunnelDropOff(funnel);
  if (!drop || drop.dropOff <= 0) return null;
  const index = funnel.findIndex((stage) => stage.id === drop.id);
  const from = index > 0 ? funnel[index - 1] : null;
  if (!from) {
    return `The largest drop-off occurred at ${drop.label}. ${countLabel(drop.dropOff, "opportunity")} did not progress.`;
  }
  return `The largest drop-off occurred between ${from.label} and ${drop.label}. ${countLabel(drop.dropOff, "opportunity")} did not progress.`;
}

export function buildPipelineHealth(snapshot: WeeklyTeamSnapshot): PipelineHealthBucket[] {
  const labels: Record<PipelineHealthBucketId, string> = {
    healthy: "Healthy",
    needs_attention: "Needs attention",
    at_risk: "At risk",
    stalled: "Stalled",
    quoted_awaiting_followup: "Quoted - awaiting follow-up",
  };
  const buckets = new Map<PipelineHealthBucketId, { count: number; value: number; causes: string[] }>();
  for (const id of Object.keys(labels) as PipelineHealthBucketId[]) {
    buckets.set(id, { count: 0, value: 0, causes: [] });
  }
  const totalValue = snapshot.activePipeline.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const totalCount = snapshot.activePipeline.length;

  for (const deal of snapshot.activePipeline) {
    const id = classifyDeal(deal, snapshot);
    const bucket = buckets.get(id)!;
    bucket.count += 1;
    bucket.value += deal.value ?? 0;
    if (id === "quoted_awaiting_followup" && !bucket.causes.includes("Missing quotation follow-up")) {
      bucket.causes.push("Missing quotation follow-up");
    }
    if (id === "stalled" && !bucket.causes.includes("Stage duration above threshold")) {
      bucket.causes.push("Stage duration above threshold");
    }
    if ((id === "at_risk" || id === "needs_attention") && !bucket.causes.includes("No recent meaningful activity")) {
      bucket.causes.push("No recent meaningful activity");
    }
  }

  return (Object.keys(labels) as PipelineHealthBucketId[]).map((id) => {
    const bucket = buckets.get(id)!;
    const pctBase = totalValue > 0 ? totalValue : totalCount;
    const amount = totalValue > 0 ? bucket.value : bucket.count;
    return {
      id,
      label: labels[id],
      count: bucket.count,
      value: bucket.value,
      pct: pctBase <= 0 ? 0 : Math.round((amount / pctBase) * 1000) / 10,
      causes: bucket.causes,
    };
  });
}

function pipelineValuePercentile(snapshot: WeeklyTeamSnapshot, fraction = 0.75): number {
  const values = snapshot.activePipeline
    .map((deal) => deal.value ?? 0)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  if (values.length === 0) return 10_000;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * fraction)));
  return Math.max(values[index] ?? 10_000, 2_500);
}

function isCustomerWaiting(item: AttentionItem): boolean {
  return (
    item.latestEvent === "Customer replied" ||
    item.latestEvent === "Customer waiting" ||
    /has not responded|still waiting/i.test(item.reason)
  );
}

function attentionTag(item: AttentionItem, highValueFloor: number): AttentionPriorityTag | null {
  if (item.priorityTag) return item.priorityTag;
  if (isCustomerWaiting(item)) return "Reply Today";
  if ((item.value ?? 0) >= highValueFloor && (item.daysInactive ?? 0) >= 5) return "High Value";
  if (/remained in/i.test(item.reason) || (item.stage === "NEGOTIATING" && (item.daysInactive ?? 0) >= 8)) {
    return "Stalled";
  }
  if (/quotation delivered|quoted/i.test(item.reason) || item.latestEvent === "Quotation sent") {
    return "Needs Review";
  }
  if ((item.daysInactive ?? 0) >= 5) return "Needs Review";
  return null;
}

function attentionRank(tag: AttentionPriorityTag | null): number {
  if (tag === "Reply Today") return 0;
  if (tag === "High Value") return 1;
  if (tag === "Stalled") return 2;
  if (tag === "Needs Review") return 3;
  return 4;
}

function mergeAttention(existing: AttentionItem, incoming: AttentionItem): AttentionItem {
  const waiting = isCustomerWaiting(existing) || isCustomerWaiting(incoming);
  return {
    ...existing,
    displayName: existing.displayName || incoming.displayName,
    salespersonName: existing.salespersonName || incoming.salespersonName,
    value: existing.value ?? incoming.value,
    stageLabel:
      existing.stageLabel && existing.stageLabel !== existing.stage ? existing.stageLabel : incoming.stageLabel,
    daysInactive: existing.daysInactive ?? incoming.daysInactive,
    lastActivityAt: existing.lastActivityAt ?? incoming.lastActivityAt,
    reason: waiting ? (isCustomerWaiting(existing) ? existing.reason : incoming.reason) : existing.reason,
    recommendedAction: waiting ? existing.recommendedAction || incoming.recommendedAction : incoming.recommendedAction,
    latestEvent: waiting
      ? isCustomerWaiting(existing)
        ? existing.latestEvent
        : incoming.latestEvent
      : existing.latestEvent,
    priorityTag: existing.priorityTag ?? incoming.priorityTag,
  };
}

export function buildAttentionList(snapshot: WeeklyTeamSnapshot): AttentionItem[] {
  const asOf = snapshot.period.endIsoExclusive;
  const items: AttentionItem[] = snapshot.attentionSeed.map((item) => ({
    ...item,
    displayName: sanitizePdfText(item.displayName, "Unnamed opportunity"),
    salespersonName: sanitizePdfText(item.salespersonName, "Unassigned"),
    priorityTag: item.priorityTag ?? (isCustomerWaiting(item) ? "Reply Today" : null),
  }));

  for (const deal of snapshot.activePipeline) {
    const bucket = classifyDeal(deal, snapshot);
    if (bucket === "healthy" && !deal.customerWaiting) continue;
    const daysInactive = daysBetween(deal.lastActivityAt, asOf);
    let reason = "Opportunity needs a review.";
    let recommendedAction = "Confirm the next action and owner.";
    let latestEvent = deal.nextActionLabel || "No next action recorded";
    if (deal.customerWaiting) {
      reason = "Customer replied and is still waiting for a salesperson response.";
      recommendedAction = "Reply today and set the next action.";
      latestEvent = "Customer waiting";
    } else if (bucket === "quoted_awaiting_followup") {
      reason = "Quotation delivered with no recorded follow-up inside the follow-up window.";
      recommendedAction = "Call or message the customer and log the follow-up.";
      latestEvent = "Quotation sent";
    } else if (bucket === "stalled") {
      reason = `Opportunity has remained in ${formatDealStage(deal.stage)} longer than the configured threshold.`;
      recommendedAction = "Decide whether to progress, requote or close.";
    } else if (bucket === "at_risk") {
      reason = `No meaningful activity for ${daysInactive ?? snapshot.health.atRiskDays}+ days.`;
      recommendedAction = "Re-engage this week or move the opportunity out of the active pipeline.";
    } else if (bucket === "healthy") {
      continue;
    } else {
      reason = "Recent activity has slowed and the next action is unclear.";
      recommendedAction = "Set a dated next action.";
    }
    items.push({
      id: deal.id,
      entityKind: "deal",
      entityId: deal.id,
      displayName: sanitizePdfText(deal.title, "Unnamed opportunity"),
      salespersonId: deal.ownerId,
      salespersonName: sanitizePdfText(deal.ownerName ?? personName(snapshot, deal.ownerId), "Unassigned"),
      value: deal.value,
      stage: deal.stage,
      stageLabel: DEAL_STAGE_LABEL[deal.stage as keyof typeof DEAL_STAGE_LABEL] ?? formatDealStage(deal.stage),
      lastActivityAt: deal.lastActivityAt,
      daysInactive,
      latestEvent,
      reason,
      recommendedAction,
      priorityTag: null,
    });
  }

  const merged = new Map<string, AttentionItem>();
  for (const item of items) {
    const key = `${item.entityKind}:${item.entityId}`;
    const existing = merged.get(key);
    merged.set(key, existing ? mergeAttention(existing, item) : item);
  }

  const highValueFloor = pipelineValuePercentile(snapshot);
  const unique = [...merged.values()].map((item) => ({
    ...item,
    priorityTag: attentionTag(item, highValueFloor),
  }));

  unique.sort((a, b) => {
    const rankDelta = attentionRank(a.priorityTag) - attentionRank(b.priorityTag);
    if (rankDelta !== 0) return rankDelta;
    const valueDelta = (b.value ?? 0) - (a.value ?? 0);
    if (valueDelta !== 0) return valueDelta;
    return (b.daysInactive ?? 0) - (a.daysInactive ?? 0);
  });
  return unique.slice(0, MAX_ATTENTION_ITEMS);
}

export function buildSalespersonNarratives(
  snapshot: WeeklyTeamSnapshot,
  ai?: WeeklyReportAiOutput | null
): SalespersonNarrative[] {
  const teamAvgFollowUps =
    snapshot.salespeople.length > 0
      ? snapshot.current.followUpsCompleted / Math.max(1, snapshot.salespeople.filter((p) => p.active).length)
      : 0;

  return snapshot.salespeople.map((person) => {
    const current = snapshot.current.leadsByPerson[person.id];
    const previous = snapshot.previous.leadsByPerson[person.id];
    const metrics = [
      comparedMetric("leads_assigned", "Leads assigned", current?.leadsAssigned ?? 0, previous?.leadsAssigned ?? 0, "count"),
      comparedMetric("leads_contacted", "Leads contacted", current?.leadsContacted ?? 0, previous?.leadsContacted ?? 0, "count"),
      comparedMetric("deals_created", "Deals created", current?.dealsCreated ?? 0, previous?.dealsCreated ?? 0, "count"),
      comparedMetric("quotations_sent", "Quotations sent", current?.quotationsSent ?? 0, previous?.quotationsSent ?? 0, "count"),
      comparedMetric("deals_won", "Deals won", current?.dealsWon ?? 0, previous?.dealsWon ?? 0, "count"),
      comparedMetric("deals_lost", "Deals lost", current?.dealsLost ?? 0, previous?.dealsLost ?? 0, "count", true),
      comparedMetric("revenue_won", "Revenue won", current?.revenueWon ?? 0, previous?.revenueWon ?? 0, "money"),
      comparedMetric(
        "active_pipeline",
        "Active pipeline",
        current?.activePipelineValue ?? 0,
        previous?.activePipelineValue ?? 0,
        "money"
      ),
      comparedMetric(
        "avg_response",
        "Average response",
        current?.avgFirstResponseMinutes ?? null,
        previous?.avgFirstResponseMinutes ?? null,
        "minutes",
        true
      ),
      comparedMetric(
        "follow_ups",
        "Follow-ups completed",
        current?.followUpsCompleted ?? 0,
        previous?.followUpsCompleted ?? 0,
        "count"
      ),
      comparedMetric("missed", "Missed follow-ups", current?.missedFollowUps ?? 0, previous?.missedFollowUps ?? 0, "count", true),
      comparedMetric("overdue", "Overdue activities", current?.overdueActivities ?? 0, previous?.overdueActivities ?? 0, "count", true),
      comparedMetric("stale", "Stale deals", current?.staleDeals ?? 0, previous?.staleDeals ?? 0, "count", true),
      comparedMetric("conversion", "Conversion rate", current?.conversionRate ?? null, previous?.conversionRate ?? null, "percent"),
    ];

    const strengths: string[] = [];
    const concerns: string[] = [];
    if ((current?.leadsContacted ?? 0) > 0 && (current?.leadsAssigned ?? 0) > 0) {
      if ((current?.leadsContacted ?? 0) >= (current?.leadsAssigned ?? 0)) {
        strengths.push("Contacted every newly assigned enquiry this week.");
      }
    }
    if ((current?.avgFirstResponseMinutes ?? null) != null && snapshot.current.avgFirstResponseMinutes != null) {
      if ((current!.avgFirstResponseMinutes as number) <= snapshot.current.avgFirstResponseMinutes) {
        strengths.push("First response time was at or faster than the team average.");
      } else {
        concerns.push("First response time was slower than the team average this week.");
      }
    }
    if ((current?.followUpsCompleted ?? 0) + 0.5 < teamAvgFollowUps && teamAvgFollowUps > 0) {
      concerns.push("Completed fewer scheduled follow-ups than the team average this week.");
    }
    if ((current?.staleDeals ?? 0) > 0) {
      concerns.push(`${current!.staleDeals} active opportunit${current!.staleDeals === 1 ? "y has" : "ies have"} gone quiet.`);
    }
    if ((current?.quotationsSent ?? 0) > 0 && (current?.dealsWon ?? 0) === 0) {
      concerns.push("Quotations were sent but no wins were recorded this week.");
    }
    if (strengths.length === 0 && (current?.dealsWon ?? 0) > 0) {
      strengths.push("Closed won business during the week.");
    }
    if (strengths.length === 0 && (current?.leadsAssigned ?? 0) === 0 && (current?.dealsCreated ?? 0) === 0) {
      strengths.push("No new assigned enquiries this week; review existing pipeline coverage.");
    }

    const reassignedInCount = snapshot.reassignments.filter((r) => r.toId === person.id).length;
    const reassignedOutCount = snapshot.reassignments.filter((r) => r.fromId === person.id).length;

    const aiRow = ai?.salespersonNarratives.find((n) => n.salespersonId === person.id);
    const coachingFocus =
      aiRow?.coachingFocus ||
      ((current?.staleDeals ?? 0) >= 5
        ? "Pipeline reactivation and next-action discipline."
        : (current?.missedFollowUps ?? 0) > 0
          ? "Follow-up cadence and dated next actions."
          : concerns[0]
            ? "Tighten response coverage and next-action discipline."
            : "Keep the current cadence and protect response time.");

    const fallbackNarrative = buildPersonFallback(person.name, current, concerns, strengths);

    return {
      salespersonId: person.id,
      name: person.name,
      active: person.active,
      metrics,
      strengths: aiRow?.strengths?.length ? aiRow.strengths : strengths,
      concerns: aiRow?.concerns?.length ? aiRow.concerns : concerns,
      coachingFocus,
      narrative: aiRow?.narrative || fallbackNarrative,
      reassignedInCount,
      reassignedOutCount,
    };
  });
}

function buildPersonFallback(
  name: string,
  current: WeeklyTeamSnapshot["current"]["leadsByPerson"][string] | undefined,
  concerns: string[],
  strengths: string[]
): string {
  const assigned = current?.leadsAssigned ?? 0;
  const won = current?.dealsWon ?? 0;
  const quotes = current?.quotationsSent ?? 0;
  const lead = `${name} was assigned ${countLabel(assigned, "lead")}, sent ${countLabel(quotes, "quotation")}, and recorded ${countLabel(won, "win")} this week.`;
  if (concerns[0]) return `${lead} ${concerns[0]}`;
  if (strengths[0]) return `${lead} ${strengths[0]}`;
  return lead;
}

export function buildConversationInsights(snapshot: WeeklyTeamSnapshot): ConversationPattern[] {
  return snapshot.conversation.patterns.map((pattern) => {
    const def = CONVERSATION_PATTERN_DEFS.find((d) => d.id === pattern.id);
    const label = def?.label ?? pattern.label;
    return {
      id: pattern.id,
      label,
      count: pattern.count,
      interpretation: conversationInterpretation(label, pattern.count),
      reliability: conversationReliability(pattern.count),
      evidence: {
        kind: "message",
        ids: pattern.sampleIds,
        label,
      },
    };
  });
}

export function buildFunnelExplanation(funnel: FunnelStageResult[], snapshot: WeeklyTeamSnapshot): TaggedInsight[] {
  const insights: TaggedInsight[] = [];
  const narrative = funnelDropNarrative(funnel);
  if (narrative) {
    insights.push({ kind: "fact", text: narrative });
  }
  const quotedIdle = snapshot.activePipeline.filter((d) => classifyDeal(d, snapshot) === "quoted_awaiting_followup");
  if (quotedIdle.length > 0) {
    insights.push({
      kind: "fact",
      text: `${countLabel(quotedIdle.length, "quoted opportunity has", "quoted opportunities have")} not received a recorded follow-up since the quotation was delivered.`,
      evidence: [{ kind: "deal", ids: quotedIdle.map((d) => d.id), label: "Quoted awaiting follow-up" }],
    });
  }
  const unworkedQualified = snapshot.current.qualifiedLeads - snapshot.current.quotationsSent;
  if (unworkedQualified > 0) {
    insights.push({
      kind: "fact",
      text: `${countLabel(unworkedQualified, "qualified opportunity", "qualified opportunities")} did not receive a quotation during the week.`,
    });
  }
  const won = funnel.find((stage) => stage.id === "won");
  if (won?.note) {
    insights.push({ kind: "interpretation", text: won.note });
  }
  return insights;
}

function delayedResponseInsight(snapshot: WeeklyTeamSnapshot): TaggedInsight | null {
  const { delayedResponses, onTimeResponses, delayedByHour } = snapshot.current;
  if (delayedResponses <= 0) return null;
  const entries = Object.entries(delayedByHour).sort((a, b) => b[1] - a[1]);
  const topHour = entries[0];
  const part = topHour ? dayPartLabel(Number(topHour[0])) : null;
  return {
    kind: "fact",
    text: `The team received ${countLabel(snapshot.current.newLeads, "new lead")}. ${countLabel(onTimeResponses, "lead")} received a response within the ${snapshot.health.slaResponseHours}-hour target, while ${countLabel(delayedResponses, "lead")} missed it.${part ? ` Most delayed responses occurred during the ${part}.` : ""}`,
  };
}

export function buildDeterministicInsights(snapshot: WeeklyTeamSnapshot): TaggedInsight[] {
  const insights: TaggedInsight[] = [];
  const quotes = snapshot.current.quotationsSent;
  const prevQuotes = snapshot.previous.quotationsSent;
  if (quotes > 0) {
    insights.push({
      kind: "fact",
      text: `${countLabel(quotes, "quotation was", "quotations were")} sent this week, compared with ${prevQuotes} last week.`,
    });
  }
  const delayed = delayedResponseInsight(snapshot);
  if (delayed) insights.push(delayed);
  if (snapshot.current.followUpsMissed > 0) {
    insights.push({
      kind: "fact",
      text: `${countLabel(snapshot.current.followUpsMissed, "follow-up task")} ${snapshot.current.followUpsMissed === 1 ? "was" : "were"} missed during the reporting period.`,
    });
    insights.push({
      kind: "interpretation",
      text: "This may indicate inconsistent follow-up discipline across the team.",
    });
  }
  if (snapshot.lostThisWeek.length > 0) {
    const value = snapshot.lostThisWeek.reduce((s, r) => s + (r.value ?? 0), 0);
    const missingReason = snapshot.lostThisWeek.filter((r) => r.reason === "Reason not recorded").length;
    insights.push({
      kind: "fact",
      text: `${countLabel(snapshot.lostThisWeek.length, "opportunity was", "opportunities were")} marked lost${value > 0 ? `, with recorded value of ${value}` : ""}.${missingReason ? ` ${countLabel(missingReason, "deal")} had no recorded loss reason.` : ""}`,
    });
  }
  return insights;
}

export function defaultCover(snapshot: WeeklyTeamSnapshot, generatedAt: Date): WeeklyReportCover {
  return {
    organisationName: snapshot.organisationName,
    organisationLogoUrl: snapshot.organisationLogoUrl,
    title: "Weekly Sales Performance Report",
    periodLabel: formatPeriodLabel(snapshot.period),
    generatedAtLabel: generatedAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: snapshot.timezone,
    }),
    preparedBy: "Prepared by SegmiQ Intelligence",
    timezone: snapshot.timezone,
    currency: snapshot.currency,
  };
}

export function mergeAiIntoPayload(
  snapshot: WeeklyTeamSnapshot,
  ai: WeeklyReportAiOutput
): WeeklyReportPayload {
  const funnel = buildFunnel(snapshot);
  const health = buildPipelineHealth(snapshot);
  const attention = buildAttentionList(snapshot);
  const conversation = buildConversationInsights(snapshot).map((row) => {
    const override = ai.conversationPatterns.find((p) => p.id === row.id);
    return override?.interpretation ? { ...row, interpretation: override.interpretation } : row;
  });
  const lostValue = snapshot.lostThisWeek.reduce((s, r) => s + (r.value ?? 0), 0);
  const prevLostValue = snapshot.lostPreviousWeek.reduce((s, r) => s + (r.value ?? 0), 0);
  const reasonCounts = countReasons(snapshot.lostThisWeek.map((r) => r.reason));
  const evidence: EvidenceRef[] = [
    ...attention.map((item) => ({
      kind: item.entityKind,
      ids: [item.entityId],
      label: item.reason,
    })),
    ...conversation.map((c) => c.evidence),
  ];

  return {
    cover: defaultCover(snapshot, new Date(snapshot.nowIso)),
    metrics: teamMetrics(snapshot.current, snapshot.previous),
    funnel,
    funnelExplanation: buildFunnelExplanation(funnel, snapshot),
    pipelineHealth: health,
    pipelineHealthNarrative: ai.pipelineNarrative,
    attention,
    salespeople: buildSalespersonNarratives(snapshot, ai),
    responseCoverage: {
      contactedAverageMinutes: snapshot.current.avgFirstResponseMinutes,
      newLeads: snapshot.current.newLeads,
      contactedLeads: snapshot.current.contactedLeads,
      onTime: snapshot.current.onTimeResponses,
      missedSla: snapshot.current.delayedResponses,
      slaHours: snapshot.health.slaResponseHours,
    },
    lostDeals: {
      count: snapshot.lostThisWeek.length,
      previousCount: snapshot.lostPreviousWeek.length,
      value: lostValue,
      previousValue: prevLostValue,
      rows: snapshot.lostThisWeek,
      reasonCounts,
      narrative: ai.lossAnalysisNarrative,
    },
    conversation,
    insights: buildDeterministicInsights(snapshot),
    ai,
    evidence,
    lowData: snapshot.activityVolume < LOW_ACTIVITY_THRESHOLD,
    activityVolume: snapshot.activityVolume,
    comparison: {
      previousWeek: snapshot.previousPeriod,
      fourWeekAverageSupported: true,
    },
  };
}

function countReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const reason of reasons) {
    map.set(reason, (map.get(reason) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export { countReasons };
