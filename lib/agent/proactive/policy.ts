import type { AgentCompanySettings } from "@/lib/agent/types";
import { TEMPORAL_TRIGGER_TYPES } from "./registry";
import { isWithinContactWindow, nextContactInstant } from "./contact-window";
import type {
  PolicyEvaluation,
  ProactiveActionMode,
  ProactiveJob,
  ProactiveSettings,
  ReasonCode,
} from "./types";

const ACTIVE_QUOTE_STATUSES = new Set(["sent", "viewed"]);
const CLOSED_DEAL_STAGES = new Set(["WON", "LOST"]);
const RECENT_HUMAN_MS = 30 * 60 * 1000;

export type ConversationSnapshot = {
  agentEnabled: boolean;
  status: string;
  humanTakeover: boolean;
  pausedUntil: string | null;
  lastCustomerMessageAt: string | null;
  lastHumanMessageAt: string | null;
  lastAgentMessageAt: string | null;
  conversationType: "SALES" | "SUPPORT" | "GENERAL";
};

export type QuotationSnapshot = {
  id: string;
  status: string;
  approvalStatus: string | null;
  revisionNumber: number;
  supersededById: string | null;
  sentAt: string | null;
  validUntil: string | null;
  quoteNumber: string | null;
  customerName: string | null;
  dealId: string | null;
  viewCount: number;
};

export type DealSnapshot = {
  id: string;
  stage: string;
  lastMeaningfulActivityAt: string | null;
  nextActionAt: string | null;
  nextActionLabel: string | null;
};

export type AppointmentSnapshot = {
  id: string;
  callbackAt: string;
  purpose: string | null;
};

export type ContactSnapshot = {
  id: string | null;
  name: string | null;
  doNotContact: boolean;
  marketingSuppressed: boolean;
};

export type ChannelSnapshot = {
  connected: boolean;
  status: string;
};

export type SupportSnapshot = {
  openHighPriority: boolean;
  openCase: boolean;
};

export type RateLimitSnapshot = {
  customerMessagesToday: number;
  conversationMessagesThisHour: number;
  companyMessagesThisHour: number;
};

export type LeadSnapshot = {
  id: string;
  followUpDate: string | null;
  followUpSource: string | null;
  ownerId: string | null;
  whatsappConversationType: string | null;
};

export type PolicyInput = {
  now: Date;
  timezone: string;
  job: Pick<
    ProactiveJob,
    "triggerType" | "attemptNumber" | "scheduledAt" | "staleAfter" | "quotationVersion" | "payload"
  >;
  maxAutonomousFollowUps: number;
  proactive: ProactiveSettings;
  agent: Pick<
    AgentCompanySettings,
    "enabled" | "autonomyMode" | "sendFollowUps" | "createTasks" | "testMode"
  >;
  conversation: ConversationSnapshot;
  lead: LeadSnapshot;
  contact: ContactSnapshot;
  channel: ChannelSnapshot;
  support: SupportSnapshot;
  rateLimits: RateLimitSnapshot;
  quotation?: QuotationSnapshot | null;
  deal?: DealSnapshot | null;
  appointment?: AppointmentSnapshot | null;
  upcomingAppointmentAt?: string | null;
  customerRepliedAfterQuoteSend?: boolean;
  humanContactedAfterQuoteSend?: boolean;
  humanContactedRecently?: boolean;
  platformProactiveDisabled?: boolean;
  platformCustomerMessagingDisabled?: boolean;
};

function skip(code: ReasonCode, reasons: string[], extra?: Partial<PolicyEvaluation>): PolicyEvaluation {
  return {
    allowed: false,
    actionMode: "NO_ACTION",
    reasonCode: code,
    reasons,
    conditions: {},
    terminalStatus: extra?.terminalStatus ?? "SKIPPED",
    ...extra,
  };
}

function allow(
  actionMode: ProactiveActionMode,
  conditions: PolicyEvaluation["conditions"],
  extra?: Partial<PolicyEvaluation>
): PolicyEvaluation {
  return {
    allowed: true,
    actionMode,
    reasonCode: extra?.reasonCode ?? null,
    reasons: extra?.reasons ?? [],
    conditions,
    approvalRequired: extra?.approvalRequired,
    nextEligibleAt: extra?.nextEligibleAt,
  };
}

/**
 * Deterministic policy. Runs before any model call.
 * Safety → contact restrictions → company permissions → commercial state → structured settings.
 */
export function evaluateProactivePolicy(input: PolicyInput): PolicyEvaluation {
  const conditions: PolicyEvaluation["conditions"] = {};

  if (input.platformProactiveDisabled) {
    return skip("PLATFORM_DISABLED", ["Platform proactive kill switch is on."]);
  }
  if (!input.agent.enabled) {
    return skip("AGENT_DISABLED", ["SegmiQ Agent is off for this company."]);
  }
  if (!input.proactive.enabled) {
    return skip("PROACTIVE_DISABLED", ["Proactive Agent is off."]);
  }
  if (input.proactive.circuitOpen) {
    return skip("CIRCUIT_OPEN", ["Proactive customer messaging is paused after repeated failures."]);
  }

  if (input.contact.doNotContact || input.contact.marketingSuppressed) {
    conditions.customerContactAllowed = false;
    if (isCustomerFacing(input.job.triggerType)) {
      return skip("CUSTOMER_OPTED_OUT", ["Customer must not be contacted."], { conditions });
    }
  } else {
    conditions.customerContactAllowed = true;
  }

  if (!input.conversation.agentEnabled) {
    if (isCustomerFacing(input.job.triggerType)) {
      return skip("AGENT_DISABLED", ["Agent is disabled on this conversation."]);
    }
  }

  const paused =
    input.conversation.status === "PAUSED" ||
    (input.conversation.pausedUntil &&
      new Date(input.conversation.pausedUntil).getTime() > input.now.getTime());
  if (paused && isCustomerFacing(input.job.triggerType)) {
    return skip("AGENT_PAUSED", ["Agent is paused on this conversation."]);
  }

  const humanActive =
    input.conversation.humanTakeover ||
    input.conversation.status === "HUMAN_HANDLING" ||
    input.conversation.status === "HUMAN_NEEDED";
  if (humanActive && isCustomerFacing(input.job.triggerType)) {
    return skip("HUMAN_ACTIVE", ["A salesperson is handling this conversation."]);
  }

  if (input.support.openHighPriority && isSalesFollowUp(input.job.triggerType)) {
    return skip("ACTIVE_SUPPORT_ESCALATION", ["An active support issue should be resolved first."]);
  }
  if (
    (input.conversation.conversationType === "SUPPORT" || input.lead.whatsappConversationType === "SUPPORT") &&
    isSalesFollowUp(input.job.triggerType)
  ) {
    return skip("ACTIVE_SUPPORT_ESCALATION", ["This conversation is in Support."]);
  }

  if (input.deal && CLOSED_DEAL_STAGES.has(input.deal.stage) && isSalesFollowUp(input.job.triggerType)) {
    return skip("DEAL_CLOSED", [`Deal is ${input.deal.stage}.`]);
  }

  if (input.job.staleAfter && input.now.getTime() > new Date(input.job.staleAfter).getTime()) {
    return skip("STALE_ACTION", ["This scheduled evaluation is past its freshness window."], {
      terminalStatus: "EXPIRED",
    });
  }

  // Trigger-specific commercial state — still no model.
  const specific = evaluateTriggerSpecific(input, conditions);
  if (specific) return specific;

  if (isCustomerFacing(input.job.triggerType)) {
    if (input.platformCustomerMessagingDisabled || !input.proactive.customerMessaging) {
      if (input.proactive.internalActions) {
        return allow("CREATE_TASK", conditions, {
          reasonCode: "CUSTOMER_MESSAGING_DISABLED",
          reasons: ["Customer-initiated outreach is off. Creating an internal task instead."],
        });
      }
      return skip("CUSTOMER_MESSAGING_DISABLED", ["Customer-initiated outreach is off."]);
    }
    if (!input.agent.sendFollowUps && input.job.triggerType !== TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE) {
      return skip("POLICY_BLOCKED", ["Follow-up sending is disabled in Agent settings."]);
    }
    if (input.humanContactedRecently || humanContactedWithin(input, RECENT_HUMAN_MS)) {
      return skip("RECENT_HUMAN_CONTACT", ["A salesperson messaged the customer recently."]);
    }
    const cfg = input.proactive.config;
    if (input.rateLimits.customerMessagesToday >= cfg.maxMessagesPerCustomerPerDay) {
      return skip("RATE_LIMITED", ["Customer daily proactive message limit reached."]);
    }
    if (input.rateLimits.conversationMessagesThisHour >= cfg.maxMessagesPerConversationPerHour) {
      return skip("RATE_LIMITED", ["Conversation hourly proactive message limit reached."]);
    }
    if (input.rateLimits.companyMessagesThisHour >= cfg.companyHourlyLimit) {
      return skip("RATE_LIMITED", ["Company hourly proactive message limit reached."]);
    }
    if (!isWithinContactWindow(input.now, input.timezone, cfg.contactWindows)) {
      const next = nextContactInstant(input.now, input.timezone, cfg.contactWindows);
      return {
        allowed: false,
        actionMode: "NO_ACTION",
        reasonCode: "CONTACT_WINDOW_CLOSED",
        reasons: ["Outside allowed contact hours — reschedule to the next window."],
        conditions,
        nextEligibleAt: next,
      };
    }
    if (!input.channel.connected) {
      return {
        allowed: false,
        actionMode: "NO_ACTION",
        reasonCode: "CHANNEL_UNAVAILABLE",
        reasons: ["WhatsApp is not connected."],
        conditions: { ...conditions, channelConnected: false },
        terminalStatus: undefined,
      };
    }
    conditions.channelConnected = true;
    conditions.contactHours = true;

    if (input.agent.autonomyMode === "ASSIST" || input.agent.testMode) {
      return allow("REQUEST_APPROVAL", conditions, {
        reasonCode: input.agent.testMode ? "SHADOW_MODE" : "AUTONOMY_ASSIST",
        approvalRequired: true,
        reasons: [
          input.agent.testMode
            ? "Test mode drafts only."
            : "Assist mode cannot send customer messages autonomously.",
        ],
      });
    }

    if (input.proactive.shadowMode) {
      return allow("CUSTOMER_MESSAGE", conditions, {
        reasonCode: "SHADOW_MODE",
        reasons: ["Shadow mode: evaluate and record, do not send."],
      });
    }

    return allow("CUSTOMER_MESSAGE", conditions);
  }

  // Internal-only triggers.
  if (!input.proactive.internalActions) {
    return skip("POLICY_BLOCKED", ["Internal proactive actions are disabled."]);
  }
  if (!input.agent.createTasks && wantsTask(input.job.triggerType, input)) {
    return allow("NOTIFY", conditions, {
      reasons: ["Task creation is disabled — notify the owner instead."],
    });
  }
  return allow(defaultInternalAction(input), conditions);
}

function evaluateTriggerSpecific(
  input: PolicyInput,
  conditions: PolicyEvaluation["conditions"]
): PolicyEvaluation | null {
  const t = input.job.triggerType;

  if (t === TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE) {
    const quote = input.quotation;
    if (!quote) return skip("QUOTE_NOT_ACTIVE", ["Quotation was not found."]);
    conditions.quoteActive = ACTIVE_QUOTE_STATUSES.has(quote.status);
    if (quote.status === "accepted") return skip("QUOTE_ACCEPTED", ["Quotation was accepted."]);
    if (quote.status === "rejected") return skip("QUOTE_DECLINED", ["Quotation was declined."]);
    if (quote.status === "expired") return skip("QUOTE_EXPIRED", ["Quotation has expired."]);
    if (quote.status === "superseded" || quote.supersededById) {
      return skip("QUOTE_SUPERSEDED", ["A newer quotation replaced this one."]);
    }
    if (quote.approvalStatus === "pending" || quote.status === "pending_approval") {
      return skip("QUOTE_PENDING_APPROVAL", ["Quotation is waiting for approval — no customer follow-up."]);
    }
    if (!ACTIVE_QUOTE_STATUSES.has(quote.status)) {
      return skip("QUOTE_NOT_ACTIVE", [`Quotation status is ${quote.status}.`]);
    }
    if (
      input.job.quotationVersion != null &&
      quote.revisionNumber !== input.job.quotationVersion
    ) {
      return skip("QUOTE_SUPERSEDED", ["Scheduled against a previous quotation version."]);
    }
    if (input.customerRepliedAfterQuoteSend) {
      return skip("CUSTOMER_ALREADY_RESPONDED", ["Customer already replied after the quotation was sent."]);
    }
    if (input.humanContactedAfterQuoteSend) {
      return skip("RECENT_HUMAN_CONTACT", ["A salesperson already followed up after the quotation was sent."]);
    }
    if (input.lead.followUpDate && followUpDateIsFuture(input.lead.followUpDate, input.now, input.timezone)) {
      return skip("CUSTOMER_REQUESTED_LATER_DATE", [
        `A follow-up is already scheduled for ${input.lead.followUpDate}.`,
      ]);
    }
    if (input.job.attemptNumber > input.maxAutonomousFollowUps) {
      conditions.maxAttempts = true;
      if (input.proactive.config.quoteAfterMaxAttempts === "NO_ACTION") {
        return skip("MAX_ATTEMPTS_REACHED", ["Maximum autonomous quotation follow-ups reached."]);
      }
      return allow(
        input.proactive.config.quoteAfterMaxAttempts === "NOTIFY" ? "NOTIFY" : "CREATE_TASK",
        conditions,
        {
          reasonCode: "MAX_ATTEMPTS_REACHED",
          reasons: ["Maximum autonomous quotation follow-ups reached."],
        }
      );
    }
    conditions.noCustomerReply = true;
    conditions.noHumanFollowUp = true;
    return null;
  }

  if (t === TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON) {
    const quote = input.quotation;
    if (!quote) return skip("QUOTE_NOT_ACTIVE", ["Quotation was not found."]);
    if (!ACTIVE_QUOTE_STATUSES.has(quote.status)) {
      return skip("QUOTE_NOT_ACTIVE", [`Quotation status is ${quote.status}.`]);
    }
    if (!input.proactive.config.quoteExpiryNotifySalesperson && !input.proactive.config.quoteExpiryCustomerReminder) {
      return skip("NO_ACTION_NEEDED", ["Quote expiry alerts are disabled."]);
    }
    if (input.proactive.config.quoteExpiryCustomerReminder && isCustomerFacing(t)) {
      return null;
    }
    return allow("NOTIFY", conditions);
  }

  if (t === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE) {
    if (input.lead.followUpDate == null) {
      return skip("NO_ACTION_NEEDED", ["The follow-up task is no longer on the Lead."]);
    }
    return null;
  }

  if (
    t === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE ||
    t === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER
  ) {
    const appt = input.appointment;
    if (!appt) return skip("STALE_ACTION", ["Appointment was not found."], { terminalStatus: "EXPIRED" });
    if (new Date(appt.callbackAt).getTime() <= input.now.getTime()) {
      return skip("STALE_ACTION", ["The appointment time has already passed."], { terminalStatus: "EXPIRED" });
    }
    if (t === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER) {
      return allow("NOTIFY", conditions);
    }
    if (!input.proactive.config.appointmentCustomerReminder) {
      return skip("POLICY_BLOCKED", ["Customer appointment reminders are off."]);
    }
    return null;
  }

  if (t === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE) {
    if (input.proactive.config.appointmentMissedCreateTask) return allow("CREATE_TASK", conditions);
    if (input.proactive.config.appointmentMissedCustomerMessage) return null;
    return skip("NO_ACTION_NEEDED", ["Missed-appointment follow-up is disabled."]);
  }

  if (t === TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE) {
    const deal = input.deal;
    if (!deal) return skip("NO_ACTION_NEEDED", ["Deal was not found."]);
    if (CLOSED_DEAL_STAGES.has(deal.stage)) return skip("DEAL_CLOSED", [`Deal is ${deal.stage}.`]);
    if (!input.proactive.config.dealInactivityEnabled) {
      return skip("POLICY_BLOCKED", ["Deal inactivity detection is off."]);
    }
    if (!input.proactive.config.dealInactivityStages.includes(deal.stage)) {
      return skip("NO_ACTION_NEEDED", [`Stage ${deal.stage} is not configured for inactivity alerts.`]);
    }
    if (input.upcomingAppointmentAt && new Date(input.upcomingAppointmentAt).getTime() > input.now.getTime()) {
      return skip("DEAL_HAS_FUTURE_APPOINTMENT", ["A site visit or callback is already scheduled."]);
    }
    if (input.lead.followUpDate && followUpDateIsFuture(input.lead.followUpDate, input.now, input.timezone)) {
      return skip("DEAL_HAS_NEXT_ACTION", ["A follow-up task already exists."]);
    }
    const action = input.proactive.config.dealInactivityAction;
    if (action === "NO_ACTION") return skip("NO_ACTION_NEEDED", ["Inactivity action is set to none."]);
    if (action === "CUSTOMER_MESSAGE") return null;
    return allow(action === "NOTIFY" ? "NOTIFY" : "CREATE_TASK", conditions);
  }

  if (t === TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING) {
    const deal = input.deal;
    if (!deal) return skip("NO_ACTION_NEEDED", ["Deal was not found."]);
    if (CLOSED_DEAL_STAGES.has(deal.stage)) return skip("DEAL_CLOSED", [`Deal is ${deal.stage}.`]);
    if (deal.nextActionAt && new Date(deal.nextActionAt).getTime() > input.now.getTime()) {
      return skip("DEAL_HAS_NEXT_ACTION", ["Deal already has a next action."]);
    }
    if (input.lead.followUpDate && followUpDateIsFuture(input.lead.followUpDate, input.now, input.timezone)) {
      return skip("DEAL_HAS_NEXT_ACTION", ["A follow-up task already exists."]);
    }
    if (input.upcomingAppointmentAt && new Date(input.upcomingAppointmentAt).getTime() > input.now.getTime()) {
      return skip("DEAL_HAS_FUTURE_APPOINTMENT", ["An appointment is already scheduled."]);
    }
    return allow("CREATE_TASK", conditions);
  }

  if (t === TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA) {
    if (!input.proactive.config.responseSlaAlertsEnabled) {
      return skip("POLICY_BLOCKED", ["Response alerts are off."]);
    }
    if (!pausedOrHuman(input) && input.conversation.agentEnabled && !input.conversation.humanTakeover) {
      return skip("NO_ACTION_NEEDED", ["The agent is already handling this conversation."]);
    }
    return allow("NOTIFY", conditions);
  }

  return null;
}

function pausedOrHuman(input: PolicyInput): boolean {
  return (
    input.conversation.humanTakeover ||
    input.conversation.status === "PAUSED" ||
    input.conversation.status === "HUMAN_HANDLING" ||
    input.conversation.status === "HUMAN_NEEDED"
  );
}

function isCustomerFacing(triggerType: string): boolean {
  return (
    triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE
  );
}

function isSalesFollowUp(triggerType: string): boolean {
  return (
    triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE
  );
}

function wantsTask(triggerType: string, input: PolicyInput): boolean {
  return (
    triggerType === TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE ||
    triggerType === TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING ||
    triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE ||
    (triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE &&
      input.job.attemptNumber > input.maxAutonomousFollowUps)
  );
}

function defaultInternalAction(input: PolicyInput): ProactiveActionMode {
  if (input.job.triggerType === TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA) return "NOTIFY";
  if (input.job.triggerType === TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON) return "NOTIFY";
  if (input.job.triggerType === TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER) return "NOTIFY";
  return "CREATE_TASK";
}

function humanContactedWithin(input: PolicyInput, windowMs: number): boolean {
  if (!input.conversation.lastHumanMessageAt) return false;
  return input.now.getTime() - new Date(input.conversation.lastHumanMessageAt).getTime() < windowMs;
}

function followUpDateIsFuture(dateOnly: string, now: Date, timezone: string): boolean {
  const today = now.toLocaleDateString("en-CA", { timeZone: timezone });
  return dateOnly > today;
}
