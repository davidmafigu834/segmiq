/**
 * Solar WhatsApp engagement and next action.
 *
 * Three separate facts:
 * - Sales stage comes from getSolarSalesStage() and is never changed here.
 * - Engagement is what the conversation is doing right now.
 * - Next action is the one thing the salesperson should do, plus an optional
 *   workflow action when the conversation and the pipeline disagree.
 *
 * Follow-up is one reminder, not a second task system:
 * - Once a deal exists, deals.next_action_at + deals.next_action_label is canonical.
 * - Before a deal, leads.follow_up_date is canonical.
 * - The snapshot field reminderAt already reads deal.next_action_at || lead.follow_up_date.
 * - Writers update only that field. A follow-up never changes the solar stage
 *   and never creates Negotiation.
 *
 * Action choice is deterministic. aiHook is a later draft/explanation input.
 * Nothing in this module sends a message.
 */

import type { SolarPanelActionKind } from "./opportunity";
import type { SolarSalesStage } from "./types";

export type SolarEngagementState =
  | "NEEDS_REPLY"
  | "WAITING_FOR_CUSTOMER"
  | "FOLLOW_UP_SCHEDULED"
  | "FOLLOW_UP_DUE"
  | "CUSTOMER_REPLIED"
  | "NO_RECENT_RESPONSE"
  | "WAITING_FOR_VISIT"
  | "NONE";

export type SolarEngagementActionKind =
  | "reply"
  | "ask"
  | "follow_up"
  | "schedule_follow_up"
  | "qualify"
  | "schedule_visit"
  | "open_visit"
  | "continue_assessment"
  | "prepare_proposal"
  | "send_quote"
  | "mark_won"
  | "create_project"
  | "open_project"
  | "none";

export type SolarNextAction = {
  kind: SolarEngagementActionKind;
  title: string | null;
  button: string | null;
  /** The WhatsApp composer is the action. This does not change the stage. */
  composer: boolean;
  changesStage: boolean;
};

export type SolarQualificationReadiness = {
  ready: boolean;
  missingFields: string[];
  recommendedQuestion: string | null;
};

export type SolarEngagementQuote = {
  number: string | null;
  total: number | null;
  currency: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  status: string | null;
};

export type SolarEngagementInput = {
  stage: SolarSalesStage;
  now: Date;
  lastMessageDirection: "inbound" | "outbound" | null;
  lastMessageAt: string | null;
  /** Canonical reminder. Prefer the snapshot reminderAt. */
  followUpAt: string | null;
  service: string | null;
  location: string | null;
  timeline: string | null;
  budget: string | null;
  visitScheduled: boolean;
  visitAt: string | null;
  assessmentCompletedAt: string | null;
  quote: SolarEngagementQuote | null;
  workflowKind: SolarPanelActionKind;
  workflowLabel: string;
  hasProject: boolean;
};

export type SolarEngagementPlan = {
  /** Echo of the sales stage. This resolver does not advance it. */
  stage: SolarSalesStage;
  engagement: SolarEngagementState;
  engagementLabel: string | null;
  engagementDetail: string | null;
  primary: SolarNextAction;
  secondary: SolarNextAction | null;
  qualification: SolarQualificationReadiness;
  scheduleFollowUp: boolean;
  contextLines: string[];
  activity: string[];
  /**
   * Later, a drafter can explain the follow-up or write the message.
   * Action selection must not call a model.
   */
  aiHook: {
    reason: string;
    draftSeed: string | null;
  };
};

const QUALIFICATION_FIELDS = [
  { key: "service", label: "Service", question: "Ask what they need" },
  { key: "location", label: "Location", question: "Ask about the area" },
  { key: "timeline", label: "Timeline", question: "Ask about the timeline" },
  { key: "budget", label: "Budget", question: "Ask about budget" },
] as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const NONE_ACTION: SolarNextAction = {
  kind: "none",
  title: null,
  button: null,
  composer: false,
  changesStage: false,
};

export function solarQualificationReadiness(input: {
  service: string | null;
  location: string | null;
  timeline: string | null;
  budget: string | null;
}): SolarQualificationReadiness {
  const values = {
    service: input.service,
    location: input.location,
    timeline: input.timeline,
    budget: input.budget,
  };
  const missing = QUALIFICATION_FIELDS.filter((field) => !values[field.key]?.trim());
  return {
    ready: missing.length === 0,
    missingFields: missing.map((field) => field.label),
    recommendedQuestion: missing[0]?.question ?? null,
  };
}

/**
 * The only follow-up write for solar WhatsApp.
 * A deal reminder and a lead reminder are not both written.
 */
export function solarFollowUpWrite(
  dealId: string | null,
  date: string
):
  | { resource: "deal"; body: { next_action_at: string; next_action_label: string } }
  | { resource: "lead"; body: { follow_up_date: string } } {
  if (dealId) {
    return {
      resource: "deal",
      body: {
        next_action_at: new Date(`${date}T10:00:00`).toISOString(),
        next_action_label: "Follow up with customer",
      },
    };
  }
  return { resource: "lead", body: { follow_up_date: date } };
}

export function resolveSolarEngagement(input: SolarEngagementInput): SolarEngagementPlan {
  const qualification = solarQualificationReadiness(input);
  const followUp = parseWhen(input.followUpAt);
  const lastMessage = parseWhen(input.lastMessageAt);
  const unanswered = input.lastMessageDirection === "inbound";
  const accepted = quoteAccepted(input.quote);
  const followUpDay = followUp ? calendarDays(input.now, followUp.date) : null;
  const followUpFuture = followUpDay != null && followUpDay > 0;
  const followUpDue = followUpDay != null && followUpDay <= 0;
  const signal = latestSignal(input);
  const viewedIsLatest = signal?.kind === "viewed";
  const viewedStale = !unanswered && !followUpFuture && !accepted && signal != null && viewedIsLatest && signal.age >= 2;
  const silence = !unanswered && !followUpFuture && !accepted && signal != null && !viewedIsLatest && signal.age >= 3;

  let engagement: SolarEngagementState = "NONE";
  let engagementLabel: string | null = null;
  let engagementDetail: string | null = null;
  let primary = NONE_ACTION;
  let secondary: SolarNextAction | null = null;
  let scheduleFollowUp = false;
  let reason = "No immediate sales follow-up.";

  const workflow = workflowAction(input, qualification);

  if (input.stage === "LOST") {
    return finish(input, qualification, {
      engagement: "NONE",
      engagementLabel: "Lost",
      engagementDetail: null,
      primary: NONE_ACTION,
      secondary: null,
      scheduleFollowUp: false,
      reason: "This opportunity is lost.",
    });
  }

  if (input.stage === "WON") {
    const project = input.hasProject
      ? action("open_project", "Open project", "Open project", false, false)
      : action("create_project", "Create project", "Create project", false, false);
    return finish(input, qualification, {
      engagement: "NONE",
      engagementLabel: "Customer won",
      engagementDetail: followUp ? `Reminder · ${formatWhen(followUp)}` : null,
      primary: project,
      secondary: null,
      scheduleFollowUp: false,
      reason: input.hasProject ? "The customer is won and a project exists." : "The customer is won and delivery has not started.",
    });
  }

  if (unanswered) {
    const asking = input.stage === "CONTACTED" && !qualification.ready && qualification.recommendedQuestion;
    engagement = asking ? "CUSTOMER_REPLIED" : "NEEDS_REPLY";
    engagementLabel = "Needs reply";
    engagementDetail = lastMessage ? `Received ${describeAge(lastMessage.date, input.now)}` : "Customer replied";
    primary = asking
      ? action("ask", qualification.recommendedQuestion, null, true, false)
      : input.stage === "NEW_LEAD"
        ? action("reply", "Reply to this customer", null, true, false)
        : action("reply", "Reply", null, true, false);
    secondary = input.stage === "CONTACTED" && qualification.ready
      ? qualifyAction()
      : workflow && workflow.kind !== "qualify"
        ? workflow
        : null;
    reason = asking
      ? `The customer replied and ${qualification.missingFields.join(", ").toLowerCase()} is still missing.`
      : "The customer is waiting for a reply.";
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp: false, reason });
  }

  if (accepted) {
    return finish(input, qualification, {
      engagement: "NONE",
      engagementLabel: "Quotation accepted",
      engagementDetail: null,
      primary: action("mark_won", "Mark deal won", "Mark deal won", false, true),
      secondary: null,
      scheduleFollowUp: false,
      reason: "The customer accepted the quotation.",
    });
  }

  if (followUpDue) {
    engagement = "FOLLOW_UP_DUE";
    engagementLabel = "Follow-up due";
    engagementDetail = followUp ? `Follow-up · ${formatWhen(followUp)}` : null;
    primary = action("follow_up", "Follow up now", "Follow up", true, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = true;
    reason = "A follow-up reminder is due. The sales stage stays the same.";
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (viewedStale) {
    engagement = "FOLLOW_UP_DUE";
    engagementLabel = "Follow-up recommended";
    engagementDetail = input.quote?.viewedAt ? `Viewed ${describeAge(new Date(input.quote.viewedAt), input.now)}` : null;
    primary = action("follow_up", "Follow up", "Follow up", true, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = true;
    reason = "The quotation was viewed and the customer has not replied.";
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (silence && signal != null && signal.age >= 7) {
    engagement = "NO_RECENT_RESPONSE";
    engagementLabel = "No recent response";
    engagementDetail = `Last contacted ${signal.age} days ago`;
    primary = action("follow_up", "Follow up now", "Follow up", true, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = true;
    reason = `No customer reply for ${signal?.age ?? 0} days.`;
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (silence) {
    engagement = "FOLLOW_UP_DUE";
    engagementLabel = "Follow-up due";
    engagementDetail = signal ? `Last contacted ${signal.age === 1 ? "yesterday" : `${signal.age} days ago`}` : null;
    primary = action("follow_up", "Follow up now", "Follow up", true, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = true;
    reason = "The customer has not replied. Follow up without moving the stage.";
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (followUpFuture && followUp) {
    engagement = "FOLLOW_UP_SCHEDULED";
    engagementLabel = input.lastMessageDirection === "outbound" || input.quote?.sentAt ? "Waiting for customer" : "Follow-up scheduled";
    engagementDetail = lastMessage && input.lastMessageDirection === "outbound"
      ? `Last message sent ${describeAge(lastMessage.date, input.now)}`
      : null;
    const title = followUpDay === 1 ? "Follow up tomorrow" : `Follow-up scheduled · ${formatWhen(followUp)}`;
    primary = action("schedule_follow_up", title, "Change reminder", false, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = true;
    reason = `A follow-up is already scheduled for ${formatWhen(followUp)}.`;
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (input.visitScheduled && input.stage === "SITE_VISIT_REQUIRED") {
    return finish(input, qualification, {
      engagement: "WAITING_FOR_VISIT",
      engagementLabel: "Waiting for visit",
      engagementDetail: input.visitAt ? `Site visit · ${formatWhen(parseWhen(input.visitAt)!)}` : "Site visit scheduled",
      primary: action("open_visit", "Open visit", "Open visit", false, false),
      secondary: null,
      scheduleFollowUp: true,
      reason: "A site visit is already scheduled.",
    });
  }

  const waiting = input.lastMessageDirection === "outbound" || Boolean(input.quote?.sentAt);
  if (waiting) {
    engagement = "WAITING_FOR_CUSTOMER";
    engagementLabel = "Waiting for customer";
    engagementDetail = lastMessage && input.lastMessageDirection === "outbound"
      ? `Last message sent ${describeAge(lastMessage.date, input.now)}`
      : input.quote?.sentAt
        ? `Sent ${describeAge(new Date(input.quote.sentAt), input.now)}`
        : null;
    primary = action("schedule_follow_up", "Schedule follow-up", null, false, false);
    secondary = quietWorkflow(workflow);
    scheduleFollowUp = input.stage !== "PROPOSAL_PREPARED";
    reason = "The last message went to the customer. Wait, or schedule a follow-up. Do not advance the stage.";
    return finish(input, qualification, { engagement, engagementLabel, engagementDetail, primary, secondary, scheduleFollowUp, reason });
  }

  if (input.stage === "NEW_LEAD") {
    return finish(input, qualification, {
      engagement: "NEEDS_REPLY",
      engagementLabel: "Needs reply",
      engagementDetail: null,
      primary: action("reply", "Reply to this customer", null, true, false),
      secondary: null,
      scheduleFollowUp: false,
      reason: "This is a new lead and nobody has replied yet.",
    });
  }

  if (input.stage === "CONTACTED" && qualification.ready) {
    return finish(input, qualification, {
      engagement: "NONE",
      engagementLabel: null,
      engagementDetail: null,
      primary: qualifyAction(),
      secondary: null,
      scheduleFollowUp: false,
      reason: "Commercial qualification is complete.",
    });
  }

  if (workflow) {
    return finish(input, qualification, {
      engagement: "NONE",
      engagementLabel: null,
      engagementDetail: null,
      primary: workflow,
      secondary: null,
      scheduleFollowUp: false,
      reason: `The next sales step is ${workflow.title}.`,
    });
  }

  return finish(input, qualification, {
    engagement,
    engagementLabel,
    engagementDetail,
    primary,
    secondary,
    scheduleFollowUp,
    reason,
  });
}

function finish(
  input: SolarEngagementInput,
  qualification: SolarQualificationReadiness,
  plan: {
    engagement: SolarEngagementState;
    engagementLabel: string | null;
    engagementDetail: string | null;
    primary: SolarNextAction;
    secondary: SolarNextAction | null;
    scheduleFollowUp: boolean;
    reason: string;
  }
): SolarEngagementPlan {
  const secondary = plan.secondary && plan.secondary.kind === plan.primary.kind ? null : plan.secondary;
  return {
    stage: input.stage,
    engagement: plan.engagement,
    engagementLabel: plan.engagementLabel,
    engagementDetail: plan.engagementDetail,
    primary: plan.primary,
    secondary,
    qualification,
    scheduleFollowUp: plan.scheduleFollowUp && input.stage !== "WON" && input.stage !== "LOST",
    contextLines: quoteContext(input),
    activity: activityLines(input),
    aiHook: {
      reason: plan.reason,
      draftSeed: draftSeed(input, plan.primary, qualification),
    },
  };
}

function qualifyAction(): SolarNextAction {
  return action("qualify", "Qualify this lead", "Qualify Lead", false, true);
}

/** Workflow buttons that move the sale. Follow-up and contact are not workflow buttons. */
function workflowAction(input: SolarEngagementInput, qualification: SolarQualificationReadiness): SolarNextAction | null {
  if (input.workflowKind === "qualify") {
    return input.stage === "CONTACTED" && qualification.ready ? qualifyAction() : null;
  }
  if (input.workflowKind === "schedule_visit" && !input.visitScheduled) {
    return action("schedule_visit", "Schedule site visit", "Schedule site visit", false, true);
  }
  if (input.workflowKind === "open_visit" || (input.workflowKind === "schedule_visit" && input.visitScheduled)) {
    return action("open_visit", "Open visit", "Open visit", false, false);
  }
  if (input.workflowKind === "continue_assessment") {
    return action("continue_assessment", "Continue assessment", "Continue assessment", false, false);
  }
  if (input.workflowKind === "prepare_proposal") {
    return action("prepare_proposal", "Prepare proposal", "Prepare proposal", false, false);
  }
  if (input.workflowKind === "send_quote") {
    return action("send_quote", "Send quote", "Send quote", false, false);
  }
  if (input.workflowKind === "mark_won") {
    return action("mark_won", "Mark deal won", "Mark deal won", false, true);
  }
  if (input.workflowKind === "create_project") {
    return action("create_project", "Create project", "Create project", false, false);
  }
  if (input.workflowKind === "open_project") {
    return action("open_project", "Open project", "Open project", false, false);
  }
  return null;
}

/** While waiting or following up, do not offer Qualify. Conversation activity owns the primary. */
function quietWorkflow(workflow: SolarNextAction | null): SolarNextAction | null {
  if (!workflow || workflow.kind === "qualify") return null;
  return workflow;
}

function action(
  kind: SolarEngagementActionKind,
  title: string | null,
  button: string | null,
  composer: boolean,
  changesStage: boolean
): SolarNextAction {
  return { kind, title, button, composer, changesStage };
}

function quoteAccepted(quote: SolarEngagementQuote | null): boolean {
  if (!quote) return false;
  return Boolean(quote.acceptedAt) || quote.status === "Accepted";
}

function quoteContext(input: SolarEngagementInput): string[] {
  const quote = input.quote;
  if (!quote) return [];
  if (input.stage !== "QUOTE_SENT" && input.stage !== "NEGOTIATION" && input.stage !== "PROPOSAL_PREPARED") return [];
  const lines: string[] = [];
  const amount = quote.total != null ? formatMoney(quote.total, quote.currency) : null;
  const identity = [quote.number, amount].filter(Boolean).join(" · ");
  if (identity) lines.push(identity);
  if (quote.sentAt) lines.push(`Sent ${describeAge(new Date(quote.sentAt), input.now)}`);
  if (quote.viewedAt) lines.push(`Viewed ${describeAge(new Date(quote.viewedAt), input.now)}`);
  return lines;
}

function activityLines(input: SolarEngagementInput): string[] {
  const events: Array<{ at: Date; label: string }> = [];
  const last = parseWhen(input.lastMessageAt);
  if (last && input.lastMessageDirection === "inbound") events.push({ at: last.date, label: "Customer replied" });
  if (last && input.lastMessageDirection === "outbound") {
    events.push({ at: last.date, label: input.stage === "NEW_LEAD" || input.stage === "CONTACTED" ? "Contacted" : "Followed up" });
  }
  const visit = parseWhen(input.visitAt);
  if (visit && input.visitScheduled) events.push({ at: visit.date, label: "Site visit scheduled" });
  const sent = parseWhen(input.quote?.sentAt ?? null);
  if (sent) events.push({ at: sent.date, label: "Quote sent" });
  const completed = parseWhen(input.assessmentCompletedAt);
  if (completed) events.push({ at: completed.date, label: "Assessment completed" });
  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4)
    .map((event) => `${event.label} · ${WEEKDAYS_SHORT[event.at.getDay()]}`);
}

function draftSeed(
  input: SolarEngagementInput,
  primary: SolarNextAction,
  qualification: SolarQualificationReadiness
): string | null {
  if (primary.kind === "ask") return qualification.recommendedQuestion;
  if (primary.kind !== "follow_up") return null;
  if (input.stage === "QUOTE_SENT" || input.stage === "NEGOTIATION") {
    return "Hi, just following up on the quotation.";
  }
  return "Hi, just following up on your solar enquiry.";
}

function latestSignal(input: SolarEngagementInput): { kind: "message" | "sent" | "viewed"; age: number } | null {
  const candidates: Array<{ kind: "message" | "sent" | "viewed"; at: string }> = [];
  if (input.lastMessageDirection === "outbound" && input.lastMessageAt) {
    candidates.push({ kind: "message", at: input.lastMessageAt });
  }
  if (input.quote?.sentAt) candidates.push({ kind: "sent", at: input.quote.sentAt });
  if (input.quote?.viewedAt) candidates.push({ kind: "viewed", at: input.quote.viewedAt });
  let latest: { kind: "message" | "sent" | "viewed"; age: number; at: number } | null = null;
  for (const candidate of candidates) {
    const parsed = parseWhen(candidate.at);
    if (!parsed) continue;
    const age = calendarDays(parsed.date, input.now);
    if (!latest || parsed.date.getTime() > latest.at) {
      latest = { kind: candidate.kind, age, at: parsed.date.getTime() };
    }
  }
  return latest ? { kind: latest.kind, age: latest.age } : null;
}

type ParsedWhen = { date: Date; dateOnly: boolean };

function parseWhen(value: string | null | undefined): ParsedWhen | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnly ? new Date(`${value}T09:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { date, dateOnly };
}

function calendarDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86_400_000);
}

function describeAge(from: Date, now: Date): string {
  const ms = now.getTime() - from.getTime();
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = calendarDays(from, now);
  if (days <= 1) return "yesterday";
  return `${days} days ago`;
}

function formatWhen(parsed: ParsedWhen): string {
  const weekday = WEEKDAYS[parsed.date.getDay()];
  if (parsed.dateOnly) return `${weekday} · 09:00`;
  const hours = String(parsed.date.getHours()).padStart(2, "0");
  const minutes = String(parsed.date.getMinutes()).padStart(2, "0");
  return `${weekday} · ${hours}:${minutes}`;
}

function formatMoney(total: number, currency: string | null): string {
  const amount = total.toLocaleString("en-US");
  return currency ? `${currency} ${amount}` : amount;
}
