/**
 * Deterministic Sales Priority Engine.
 * Generates and ranks next-best-action candidates from real lead signals.
 * attentionScore is for sorting only — explain with reasonCode + reason text.
 */

import { SCORE_HOT_MIN, SCORE_WARM_MIN } from "@/lib/inbox/scoring";
import {
  ACTIVE_PIPELINE_STATUSES,
  DEFAULT_FRESH_LEAD_WINDOW_MINUTES,
  DEFAULT_PRIORITY_QUEUE_LIMIT,
  INBOUND_LEAD_SOURCES,
  OPEN_QUOTE_STATUSES,
} from "./defaults";
import { hoursSince, minutesSince } from "./meaningful-activity";
import { actionTypeLabel, reasonText } from "./reasons";
import { buildIdempotencyKey } from "./timezone";
import type {
  ActionStateRow,
  AvailableContactAction,
  LeadIntelligenceSignal,
  PriorityEngineContext,
  SalesActionRecommendation,
  SalesActionReasonCode,
  SalesActionType,
} from "./types";

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function scoreBand(score: number | null): "Hot" | "Warm" | "Cold" | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= SCORE_HOT_MIN) return "Hot";
  if (score >= SCORE_WARM_MIN) return "Warm";
  return "Cold";
}

function effectiveIntent(lead: LeadIntelligenceSignal): number {
  if (lead.manualPriority === "hot") return Math.max(lead.score ?? 0, SCORE_HOT_MIN);
  if (lead.manualPriority === "warm") return Math.max(lead.score ?? 0, SCORE_WARM_MIN);
  if (lead.manualPriority === "cold") return Math.min(lead.score ?? 20, SCORE_WARM_MIN - 1);
  return lead.score ?? 0;
}

function formatAgeMinutes(mins: number): string {
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function formatOverdue(msLate: number): string {
  const mins = Math.floor(msLate / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function formatHoursAsAge(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  const d = Math.round(hours / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Lead";
  const map: Record<string, string> = {
    FACEBOOK: "Facebook",
    FACEBOOK_AD: "Facebook",
    WHATSAPP_INBOUND: "WhatsApp",
    LANDING_PAGE: "Website",
    WEBSITE: "Website",
    MANUAL: "Manual",
    REFERRAL: "Referral",
  };
  return map[source] ?? source.replace(/_/g, " ");
}

function contactActions(lead: LeadIntelligenceSignal): AvailableContactAction[] {
  const actions: AvailableContactAction[] = [];
  if (lead.phone) actions.push("call");
  if (lead.isWhatsAppCapable || lead.phone) actions.push("whatsapp");
  actions.push("open_lead");
  return actions;
}

function baseRec(opts: {
  ctx: PriorityEngineContext;
  lead: LeadIntelligenceSignal | null;
  actionType: SalesActionType;
  reasonCode: SalesActionReasonCode;
  attentionScore: number;
  title: string;
  subtitle: string | null;
  reasonCtx?: Record<string, string | number | null | undefined>;
  urgencyLabel: string | null;
  dueAt: string | null;
  availableActions: AvailableContactAction[];
  metadata?: Record<string, unknown>;
  origin?: SalesActionRecommendation["origin"];
}): SalesActionRecommendation {
  const sourceEntityId = opts.lead?.dealId ?? opts.lead?.id ?? null;
  const idempotencyKey = buildIdempotencyKey({
    salespersonId: opts.ctx.salespersonId,
    planDate: opts.ctx.planDate,
    actionType: opts.actionType,
    sourceEntityId,
    reasonCode: opts.reasonCode,
  });

  return {
    id: idempotencyKey,
    idempotencyKey,
    actionType: opts.actionType,
    origin: opts.origin ?? "SYSTEM_RECOMMENDED",
    sourceEntityType: opts.lead?.dealId
      ? "deal"
      : opts.lead
        ? "lead"
        : opts.actionType === "PROSPECT_NEW_CUSTOMERS"
          ? "goal"
          : "none",
    sourceEntityId,
    attentionScore: clamp(opts.attentionScore),
    title: opts.title,
    subtitle: opts.subtitle,
    recommendedActionLabel: actionTypeLabel(opts.actionType),
    reasonCode: opts.reasonCode,
    reason: reasonText(opts.reasonCode, opts.reasonCtx),
    urgencyLabel: opts.urgencyLabel,
    dueAt: opts.dueAt,
    customer: opts.lead
      ? {
          leadId: opts.lead.id,
          name: opts.lead.name?.trim() || "Unnamed lead",
          phone: opts.lead.phone,
          score: opts.lead.score,
          scoreBand: scoreBand(effectiveIntent(opts.lead)),
          source: opts.lead.source,
          status: opts.lead.status,
          projectType: opts.lead.projectType,
          dealValue: opts.lead.dealValue,
        }
      : null,
    availableActions: opts.availableActions,
    metadata: {
      ...(opts.metadata ?? {}),
      ...(opts.lead?.dealId ? { dealId: opts.lead.dealId, leadId: opts.lead.id } : {}),
    },
  };
}

function weightedScore(parts: Partial<Record<keyof PriorityEngineContext["weights"], number>>, weights: PriorityEngineContext["weights"]): number {
  let total = 0;
  let max = 0;
  (Object.keys(weights) as Array<keyof typeof weights>).forEach((k) => {
    const w = weights[k];
    max += w;
    total += w * clamp(parts[k] ?? 0) / 100;
  });
  if (max <= 0) return 0;
  return clamp((total / max) * 100);
}

function isActive(status: string): boolean {
  return ACTIVE_PIPELINE_STATUSES.has(status);
}

function generateLeadCandidates(
  lead: LeadIntelligenceSignal,
  ctx: PriorityEngineContext
): SalesActionRecommendation[] {
  if (!isActive(String(lead.status))) return [];
  if (lead.assignedToId !== ctx.salespersonId) return [];

  const out: SalesActionRecommendation[] = [];
  const now = ctx.now;
  const intent = effectiveIntent(lead);
  const band = scoreBand(intent);
  const ageMinutes = minutesSince(lead.createdAt, now) ?? 999999;
  const inactivityHours = hoursSince(lead.lastMeaningfulActivityAt ?? lead.createdAt, now) ?? 0;
  const stageKey = String(lead.status);
  const stageThreshold = ctx.stageInactivityHours[stageKey] ?? ctx.stageInactivityHours.CONTACTED ?? 72;
  const isInbound = INBOUND_LEAD_SOURCES.has(String(lead.source ?? ""));
  const noFirstResponse = !lead.firstRespondedAt;
  const name = lead.name?.trim() || "Unnamed lead";
  /** Already in an active sales thread — not a brand-new unread WhatsApp chat. */
  const hasMeaningfulSalesThread = Boolean(
    lead.firstRespondedAt ||
      lead.dealId ||
      lead.openQuote ||
      lead.followUpDate ||
      lead.callbackAt ||
      lead.hasFutureNextAction
  );

  // 1. Uncontacted / new enquiries — NOT main Today's Focus.
  // WhatsApp already surfaces unread. These go to the New Enquiries assist lane.
  if (
    noFirstResponse &&
    (lead.status === "NEW" || lead.status === "CONTACTED") &&
    (lead.awaitingReplyMinutes != null ||
      (isInbound && ageMinutes <= DEFAULT_FRESH_LEAD_WINDOW_MINUTES * 12))
  ) {
    const freshness = clamp(100 - ageMinutes / 3);
    const score = weightedScore(
      {
        freshness: isInbound ? freshness : freshness * 0.7,
        intent: Math.max(intent, 40),
        responseUrgency: lead.awaitingReplyMinutes != null ? 70 : 50,
        customerWaiting: 0,
        followUpUrgency: 0,
        stageUrgency: lead.status === "NEW" ? 60 : 40,
        valueSignal: lead.dealValue ? Math.min(100, lead.dealValue / 500) : 15,
      },
      ctx.weights
    );
    out.push(
      baseRec({
        ctx,
        lead,
        actionType: "CONTACT_NEW_LEAD",
        reasonCode: intent >= SCORE_HOT_MIN ? "HIGH_INTENT_NEW_LEAD" : "HIGH_INTENT_NEW_LEAD",
        attentionScore: Math.min(score, 55),
        title: name,
        subtitle: [band, sourceLabel(lead.source), "New enquiry"].filter(Boolean).join(" · ") || null,
        reasonCtx: {
          ageLabel: formatAgeMinutes(ageMinutes),
          sourceLabel: sourceLabel(lead.source),
        },
        urgencyLabel: `Received ${formatAgeMinutes(ageMinutes)}`,
        dueAt: null,
        availableActions: contactActions(lead),
        metadata: {
          projectType: lead.projectType,
          focusLane: "new_enquiry",
          lastInboundWaitingMinutes: lead.awaitingReplyMinutes,
        },
      })
    );
  }

  // 2. Customer waiting — ONLY mid-thread (salesperson already engaged / deal / quote / follow-up).
  // Do not flood Today's Focus with brand-new unread WhatsApp chats.
  if (
    hasMeaningfulSalesThread &&
    lead.awaitingReplyMinutes != null &&
    lead.awaitingReplyMinutes >= 0
  ) {
    const wait = lead.awaitingReplyMinutes;
    const waitingScore = clamp(70 + Math.min(30, wait / 2));
    const score = weightedScore(
      {
        customerWaiting: waitingScore,
        intent,
        responseUrgency: waitingScore,
        freshness: clamp(100 - wait / 5),
        followUpUrgency: lead.followUpDate || lead.callbackAt ? 40 : 10,
      },
      ctx.weights
    );
    out.push(
      baseRec({
        ctx,
        lead,
        actionType: "RESPOND_TO_CUSTOMER",
        reasonCode: "CUSTOMER_WAITING",
        attentionScore: score + 20,
        title: name,
        subtitle: "Waiting for reply",
        reasonCtx: { name, ageLabel: formatAgeMinutes(wait) },
        urgencyLabel: `Waiting ${formatAgeMinutes(wait)}`,
        dueAt: null,
        availableActions: contactActions(lead).includes("whatsapp")
          ? contactActions(lead)
          : (["whatsapp", ...contactActions(lead)] as AvailableContactAction[]),
        metadata: { focusLane: "focus", meaningfulThread: true },
      })
    );
  }

  // 3. Overdue / due today follow-ups
  const dueIso = lead.callbackAt || lead.followUpDate;
  if (dueIso) {
    const dueMs = new Date(dueIso).getTime();
    if (Number.isFinite(dueMs)) {
      const late = now.getTime() - dueMs;
      const isOverdue = late > 0;
      const dueToday =
        !isOverdue &&
        new Date(dueIso).toISOString().slice(0, 10) === ctx.planDate;
      if (isOverdue || dueToday) {
        const followUrgency = isOverdue ? clamp(75 + Math.min(25, late / 3_600_000)) : 60;
        const score = weightedScore(
          {
            followUpUrgency: followUrgency,
            intent,
            stageUrgency: stageKey === "PROPOSAL_SENT" || stageKey === "NEGOTIATING" ? 70 : 40,
            appointmentUrgency: lead.callbackAt ? 80 : 50,
          },
          ctx.weights
        );
        const managerAssigned =
          lead.followUpCreatedById != null && lead.followUpCreatedById !== ctx.salespersonId;
        out.push(
          baseRec({
            ctx,
            lead,
            actionType: lead.callbackAt ? "COMPLETE_SCHEDULED_CALL" : "COMPLETE_FOLLOW_UP",
            reasonCode: isOverdue
              ? "FOLLOWUP_OVERDUE"
              : managerAssigned
                ? "MANAGER_ASSIGNED"
                : "FOLLOWUP_DUE_TODAY",
            attentionScore: score + (isOverdue ? 28 : 8) + (managerAssigned ? 5 : 0),
            title: name,
            subtitle: stageKey.replace(/_/g, " "),
            reasonCtx: isOverdue ? { overdueLabel: formatOverdue(late) } : undefined,
            urgencyLabel: isOverdue ? `Overdue by ${formatOverdue(late)}` : "Due today",
            dueAt: dueIso,
            availableActions: contactActions(lead),
            origin: managerAssigned ? "MANAGER_ASSIGNED" : "SYSTEM_RECOMMENDED",
          })
        );
      }
    }
  }

  // 4. Quote follow-up and commercial next actions
  if (lead.openQuote) {
    const quote = lead.openQuote;
    if (quote.approvalStatus === "pending" || quote.approvalStatus === "required") {
      out.push(
        baseRec({
          ctx,
          lead,
          actionType: "FOLLOW_UP_QUOTE",
          reasonCode: "QUOTE_APPROVAL_NEEDED",
          attentionScore: 86,
          title: name,
          subtitle: [quote.quoteNumber, "Request commercial approval"].filter(Boolean).join(" · "),
          urgencyLabel: "Approval required",
          dueAt: null,
          availableActions: ["open_lead"],
          metadata: { quotationId: quote.id },
        })
      );
    } else if (quote.approvalStatus === "changes_requested" || quote.customerResponded) {
      out.push(
        baseRec({
          ctx,
          lead,
          actionType: "FOLLOW_UP_QUOTE",
          reasonCode: quote.customerResponded ? "QUOTE_CUSTOMER_CHANGES" : "QUOTE_APPROVAL_NEEDED",
          attentionScore: 88,
          title: name,
          subtitle: [quote.quoteNumber, quote.customerResponded ? "Review customer request" : "Update and resubmit"].filter(Boolean).join(" · "),
          urgencyLabel: "Needs revision",
          dueAt: null,
          availableActions: ["open_lead"],
          metadata: { quotationId: quote.id },
        })
      );
    } else if (quote.validUntil) {
      const days = Math.ceil((new Date(quote.validUntil).getTime() - now.getTime()) / 86400000);
      if (days >= 0 && days <= 1 && OPEN_QUOTE_STATUSES.has(quote.status)) {
        out.push(
          baseRec({
            ctx,
            lead,
            actionType: "FOLLOW_UP_QUOTE",
            reasonCode: "QUOTE_EXPIRING",
            attentionScore: 84,
            title: name,
            subtitle: [quote.quoteNumber, "Expires tomorrow"].filter(Boolean).join(" · "),
            urgencyLabel: "Expiring",
            dueAt: quote.validUntil,
            availableActions: contactActions(lead),
            metadata: { quotationId: quote.id },
          })
        );
      }
    }
    if (
      quote.viewedAt &&
      OPEN_QUOTE_STATUSES.has(quote.status) &&
      !lead.hasFutureNextAction
    ) {
      const viewedH = hoursSince(quote.viewedAt, now);
      if (viewedH != null && viewedH <= 24) {
        out.push(
          baseRec({
            ctx,
            lead,
            actionType: "FOLLOW_UP_QUOTE",
            reasonCode: "QUOTE_VIEWED",
            attentionScore: 80,
            title: name,
            subtitle: [quote.quoteNumber, "Customer viewed quotation"].filter(Boolean).join(" · "),
            urgencyLabel: "Viewed recently",
            dueAt: null,
            availableActions: contactActions(lead),
            metadata: { quotationId: quote.id },
          })
        );
      }
    }
  }

  if (
    lead.openQuote &&
    OPEN_QUOTE_STATUSES.has(lead.openQuote.status) &&
    !lead.hasFutureNextAction
  ) {
    const sentAt = lead.openQuote.sentAt;
    const quoteAgeH = hoursSince(sentAt, now);
    if (quoteAgeH != null && quoteAgeH >= ctx.quoteFollowupHours) {
      const score = weightedScore(
        {
          quoteUrgency: clamp(60 + quoteAgeH),
          stageUrgency: 75,
          intent,
          valueSignal: lead.openQuote.total ? Math.min(100, lead.openQuote.total / 500) : 30,
          followUpUrgency: 40,
        },
        ctx.weights
      );
      out.push(
        baseRec({
          ctx,
          lead,
          actionType: "FOLLOW_UP_QUOTE",
          reasonCode: "QUOTE_WAITING",
          attentionScore: score + 8,
          title: name,
          subtitle: [
            lead.openQuote.quoteNumber,
            lead.openQuote.total != null ? `$${Math.round(lead.openQuote.total).toLocaleString()}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Open quotation",
          reasonCtx: { ageLabel: `for ${formatHoursAsAge(quoteAgeH)}` },
          urgencyLabel: `Sent ${formatHoursAsAge(quoteAgeH)} ago`,
          dueAt: null,
          availableActions: contactActions(lead),
          metadata: { quotationId: lead.openQuote.id },
        })
      );
    }
  }

  // 5. Late-stage negotiation follow-up without next action
  if (
    (lead.status === "NEGOTIATING" || lead.status === "PROPOSAL_SENT") &&
    !lead.hasFutureNextAction &&
    !(lead.openQuote && OPEN_QUOTE_STATUSES.has(lead.openQuote.status))
  ) {
    const score = weightedScore(
      {
        stageUrgency: 85,
        intent,
        followUpUrgency: 35,
        valueSignal: lead.dealValue ? Math.min(100, lead.dealValue / 500) : 25,
      },
      ctx.weights
    );
    out.push(
      baseRec({
        ctx,
        lead,
        actionType: lead.status === "PROPOSAL_SENT" ? "FOLLOW_UP_QUOTE" : "FOLLOW_UP_NEGOTIATION",
        reasonCode: "LATE_STAGE_NEEDS_ACTION",
        attentionScore: score + 6,
        title: name,
        subtitle: String(lead.status).replace(/_/g, " "),
        urgencyLabel: "Needs next step",
        dueAt: null,
        availableActions: [...contactActions(lead), "schedule_follow_up"],
      })
    );
  }

  // 6. Stale / at-risk re-engage
  if (inactivityHours >= stageThreshold && !lead.awaitingReplyMinutes) {
    const score = weightedScore(
      {
        inactivityRisk: clamp(50 + inactivityHours / 2),
        stageUrgency: stageKey === "NEW" ? 70 : 55,
        intent,
        valueSignal: lead.dealValue ? Math.min(100, lead.dealValue / 500) : 20,
      },
      ctx.weights
    );
    out.push(
      baseRec({
        ctx,
        lead,
        actionType: "REENGAGE_STALE_DEAL",
        reasonCode: "DEAL_STALE",
        attentionScore: score + 4,
        title: name,
        subtitle: String(lead.status).replace(/_/g, " "),
        reasonCtx: { ageLabel: formatHoursAsAge(inactivityHours) },
        urgencyLabel: `No activity for ${formatHoursAsAge(inactivityHours)}`,
        dueAt: null,
        availableActions: contactActions(lead),
        metadata: { isAtRisk: true, inactivityHours },
      })
    );
  }

  // 7. No next action (active deal without future follow-up / callback / appointment)
  if (
    !lead.hasFutureNextAction &&
    !(lead.followUpDate || lead.callbackAt) &&
    lead.firstRespondedAt &&
    lead.status !== "NEW"
  ) {
    const alreadyCovered = out.some(
      (c) =>
        c.sourceEntityId === lead.id &&
        (c.reasonCode === "LATE_STAGE_NEEDS_ACTION" ||
          c.reasonCode === "QUOTE_WAITING" ||
          c.reasonCode === "DEAL_STALE" ||
          c.reasonCode === "HIGH_INTENT_NEW_LEAD")
    );
    if (!alreadyCovered) {
      const score = weightedScore(
        {
          stageUrgency: 50,
          followUpUrgency: 45,
          intent,
        },
        ctx.weights
      );
      out.push(
        baseRec({
          ctx,
          lead,
          actionType: "SCHEDULE_NEXT_ACTION",
          reasonCode: "NO_NEXT_ACTION",
          attentionScore: score,
          title: name,
          subtitle: "Next action needed",
          urgencyLabel: "No next action",
          dueAt: null,
          availableActions: ["schedule_follow_up", ...contactActions(lead)],
        })
      );
    }
  }

  return out;
}

/** Deduplicate: keep highest-scoring candidate per lead/deal entity (except prospecting). */
function dedupeByLead(candidates: SalesActionRecommendation[]): SalesActionRecommendation[] {
  const byEntity = new Map<string, SalesActionRecommendation>();
  const nonLead: SalesActionRecommendation[] = [];
  for (const c of candidates) {
    if (!c.sourceEntityId || c.actionType === "PROSPECT_NEW_CUSTOMERS") {
      nonLead.push(c);
      continue;
    }
    const key = `${c.sourceEntityType}:${c.sourceEntityId}`;
    const prev = byEntity.get(key);
    if (!prev || c.attentionScore > prev.attentionScore) {
      byEntity.set(key, c);
    }
  }
  return [...byEntity.values(), ...nonLead];
}

function stableSort(a: SalesActionRecommendation, b: SalesActionRecommendation): number {
  if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
  const aDue = a.dueAt ?? "";
  const bDue = b.dueAt ?? "";
  if (aDue !== bDue) return aDue.localeCompare(bDue);
  return a.idempotencyKey.localeCompare(b.idempotencyKey);
}

function isSuppressed(
  rec: SalesActionRecommendation,
  states: ActionStateRow[],
  now: Date
): boolean {
  const state = states.find((s) => s.idempotencyKey === rec.idempotencyKey);
  if (!state) return false;
  if (state.state === "completed" || state.state === "resolved" || state.state === "skipped") {
    return true;
  }
  if (state.state === "snoozed" && state.snoozedUntil) {
    return new Date(state.snoozedUntil).getTime() > now.getTime();
  }
  return false;
}

/**
 * Pure priority engine entrypoint.
 */
export function rankSalesActions(opts: {
  leads: LeadIntelligenceSignal[];
  ctx: PriorityEngineContext;
  actionStates?: ActionStateRow[];
  queueLimit?: number;
}): {
  nextBestAction: SalesActionRecommendation | null;
  queue: SalesActionRecommendation[];
  /** Brand-new uncontacted enquiries — assist lane, not Today's Focus. */
  newEnquiries: SalesActionRecommendation[];
  all: SalesActionRecommendation[];
  dealActionCount: number;
} {
  const states = opts.actionStates ?? [];
  const limit = opts.queueLimit ?? DEFAULT_PRIORITY_QUEUE_LIMIT;

  let candidates: SalesActionRecommendation[] = [];
  for (const lead of opts.leads) {
    candidates.push(...generateLeadCandidates(lead, opts.ctx));
  }

  candidates = dedupeByLead(candidates);

  const dealActions = candidates.filter(
    (c) => c.actionType !== "PROSPECT_NEW_CUSTOMERS" && c.actionType !== "ADD_VALID_PROSPECT"
  );

  // Prospecting only when deal queue is empty (or only low-urgency) AND goal/pipeline says build
  const coverageLow =
    opts.ctx.remainingGoalValue != null &&
    opts.ctx.remainingGoalValue > 0 &&
    (opts.ctx.activePipelineValue == null ||
      opts.ctx.activePipelineValue < opts.ctx.remainingGoalValue);

  const meaningfulDealWork = dealActions.filter(
    (c) => c.attentionScore >= 35 && c.metadata?.focusLane !== "new_enquiry"
  );
  if (
    meaningfulDealWork.length === 0 &&
    (opts.ctx.hasConfiguredProspectTarget || coverageLow || opts.leads.filter((l) => isActive(String(l.status))).length === 0)
  ) {
    const remaining =
      opts.ctx.prospectTarget != null
        ? Math.max(0, opts.ctx.prospectTarget - opts.ctx.prospectsCompletedToday)
        : null;
    candidates.push(
      baseRec({
        ctx: opts.ctx,
        lead: null,
        actionType: "PROSPECT_NEW_CUSTOMERS",
        reasonCode: coverageLow ? "GOAL_PIPELINE_LOW" : "PROSPECTING_COMMITMENT",
        attentionScore: 25,
        title: "Create new opportunities",
        subtitle:
          remaining != null
            ? `${opts.ctx.prospectsCompletedToday} / ${opts.ctx.prospectTarget} valid prospects`
            : "Build pipeline",
        urgencyLabel: remaining != null ? `${remaining} remaining today` : null,
        dueAt: null,
        availableActions: ["add_prospect", "log_outreach"],
        origin: opts.ctx.hasConfiguredProspectTarget ? "GOAL_COMMITMENT" : "SYSTEM_RECOMMENDED",
        metadata: {
          prospectsCompleted: opts.ctx.prospectsCompletedToday,
          prospectTarget: opts.ctx.prospectTarget,
        },
      })
    );
  }

  const visible = candidates
    .filter((c) => !isSuppressed(c, states, opts.ctx.now))
    .sort(stableSort);

  const newEnquiries = visible
    .filter((c) => c.metadata?.focusLane === "new_enquiry")
    .slice(0, Math.max(limit, 12));
  const salesWork = visible.filter((c) => c.metadata?.focusLane !== "new_enquiry");
  const queue = salesWork.slice(0, limit);

  return {
    nextBestAction: queue[0] ?? null,
    queue,
    newEnquiries,
    all: salesWork,
    dealActionCount: meaningfulDealWork.filter((c) => !isSuppressed(c, states, opts.ctx.now)).length,
  };
}

/** Resolve which existing recommendations should clear given updated lead signals. */
export function shouldResolveRecommendation(
  rec: Pick<SalesActionRecommendation, "actionType" | "reasonCode" | "sourceEntityId">,
  lead: LeadIntelligenceSignal | null
): boolean {
  if (!rec.sourceEntityId) return false;
  if (!lead || lead.id !== rec.sourceEntityId) {
    return true;
  }
  if (!isActive(String(lead.status))) return true;

  switch (rec.reasonCode) {
    case "HIGH_INTENT_NEW_LEAD":
      return Boolean(lead.firstRespondedAt);
    case "CUSTOMER_WAITING":
      return lead.awaitingReplyMinutes == null;
    case "FOLLOWUP_OVERDUE":
    case "FOLLOWUP_DUE_TODAY":
    case "SCHEDULED_TODAY":
    case "MANAGER_ASSIGNED":
      return !lead.followUpDate && !lead.callbackAt;
    case "QUOTE_WAITING":
      return !lead.openQuote || Boolean(lead.hasFutureNextAction);
    case "NO_NEXT_ACTION":
      return lead.hasFutureNextAction || Boolean(lead.followUpDate || lead.callbackAt);
    case "DEAL_STALE":
      return false;
    default:
      return false;
  }
}
