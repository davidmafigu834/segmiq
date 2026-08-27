import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetClock, setClockTo, now } from "../lib/clock";
import { addBusinessDays, businessDaysBetween } from "../lib/agent/proactive/business-days";
import { isWithinContactWindow, nextContactInstant } from "../lib/agent/proactive/contact-window";
import { isAmbiguousCommitment, isProactiveOptOutMessage } from "../lib/agent/proactive/opt-out";
import { eventFingerprint, jobFingerprint } from "../lib/agent/proactive/registry";
import { evaluateProactivePolicy, type PolicyInput } from "../lib/agent/proactive/policy";
import {
  appointmentReminderMessage,
  quoteFollowUpFallback,
  sanitizeProactiveMessage,
} from "../lib/agent/proactive/templates";
import { DEFAULT_CONTACT_WINDOWS, DEFAULT_PROACTIVE_CONFIG, type ProactiveSettings } from "../lib/agent/proactive/types";
import { TEMPORAL_TRIGGER_TYPES } from "../lib/agent/proactive/registry";
import type { AgentCompanySettings } from "../lib/agent/types";

afterEach(() => resetClock());

const TZ = "Africa/Harare";

function proactive(overrides: Partial<ProactiveSettings> = {}): ProactiveSettings {
  return {
    clientId: "co-a",
    enabled: true,
    shadowMode: false,
    customerMessaging: true,
    internalActions: true,
    circuitOpen: false,
    circuitOpenedAt: null,
    circuitReason: null,
    config: { ...DEFAULT_PROACTIVE_CONFIG },
    ...overrides,
  };
}

function agent(overrides: Partial<AgentCompanySettings> = {}): AgentCompanySettings {
  return {
    clientId: "co-a",
    enabled: true,
    autonomyMode: "COPILOT",
    respondToEnquiries: true,
    qualifyLeads: true,
    createLeads: true,
    createDeals: true,
    createTasks: true,
    scheduleCallbacks: true,
    scheduleAppointments: true,
    rescheduleAppointments: true,
    prepareQuotations: true,
    sendQuotations: false,
    sendFollowUps: true,
    transferSupport: true,
    createSupportCases: true,
    negotiateDiscounts: false,
    quoteAutoSendLimit: null,
    businessHoursPolicy: "ALWAYS",
    disclosureText: null,
    tone: "professional",
    languagePreference: null,
    escalationUserId: null,
    maxQuestionsPerMessage: 2,
    debounceSeconds: 6,
    dailyExecutionLimit: 300,
    conversationHourlyLimit: 12,
    testMode: false,
    learningEnabled: false,
    suggestReplies: false,
    ...overrides,
  };
}

function baseInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    now: new Date("2026-08-26T08:00:00.000Z"),
    timezone: TZ,
    job: {
      triggerType: TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
      attemptNumber: 1,
      scheduledAt: "2026-08-26T08:00:00.000Z",
      staleAfter: "2026-08-27T20:00:00.000Z",
      quotationVersion: 1,
      payload: {},
    },
    maxAutonomousFollowUps: 2,
    proactive: proactive(),
    agent: agent(),
    conversation: {
      agentEnabled: true,
      status: "WAITING_ON_CUSTOMER",
      humanTakeover: false,
      pausedUntil: null,
      lastCustomerMessageAt: "2026-08-24T08:00:00.000Z",
      lastHumanMessageAt: null,
      lastAgentMessageAt: null,
      conversationType: "SALES",
    },
    lead: {
      id: "lead-1",
      followUpDate: null,
      followUpSource: null,
      ownerId: "user-1",
      whatsappConversationType: "SALES",
    },
    contact: { id: "c1", name: "Tendai Moyo", doNotContact: false, marketingSuppressed: false },
    channel: { connected: true, status: "CONNECTED" },
    support: { openHighPriority: false, openCase: false },
    rateLimits: { customerMessagesToday: 0, conversationMessagesThisHour: 0, companyMessagesThisHour: 0 },
    quotation: {
      id: "q-0042",
      status: "sent",
      approvalStatus: "not_required",
      revisionNumber: 1,
      supersededById: null,
      sentAt: "2026-08-24T08:00:00.000Z",
      validUntil: "2026-09-07",
      quoteNumber: "Q-0042",
      customerName: "Tendai Moyo",
      dealId: "deal-1",
      viewCount: 0,
    },
    deal: {
      id: "deal-1",
      stage: "PROPOSAL_SENT",
      lastMeaningfulActivityAt: "2026-08-24T08:00:00.000Z",
      nextActionAt: null,
      nextActionLabel: null,
    },
    customerRepliedAfterQuoteSend: false,
    humanContactedAfterQuoteSend: false,
    ...overrides,
  };
}

describe("business days", () => {
  it("Friday 10:00 + 2 business days is Tuesday 10:00, not Sunday", () => {
    // Friday 21 Aug 2026 10:00 CAT = 08:00 UTC
    const from = new Date("2026-08-21T08:00:00.000Z");
    const result = addBusinessDays({ from, days: 2, timezone: TZ, workingDays: [1, 2, 3, 4, 5] });
    assert.equal(result.toISOString(), "2026-08-25T08:00:00.000Z");
  });

  it("does not use raw +48 hours", () => {
    const from = new Date("2026-08-21T08:00:00.000Z");
    const plus48 = new Date(from.getTime() + 48 * 3600_000);
    const result = addBusinessDays({ from, days: 2, timezone: TZ });
    assert.notEqual(result.toISOString(), plus48.toISOString());
  });

  it("counts business days between Monday and Wednesday as 2", () => {
    const n = businessDaysBetween({
      from: new Date("2026-08-24T08:00:00.000Z"),
      to: new Date("2026-08-26T08:00:00.000Z"),
      timezone: TZ,
    });
    assert.equal(n, 2);
  });
});

describe("contact windows", () => {
  it("reschedules 21:30 to next 08:00", () => {
    const due = new Date("2026-08-25T19:30:00.000Z"); // 21:30 CAT
    const next = nextContactInstant(due, TZ, DEFAULT_CONTACT_WINDOWS);
    assert.equal(isWithinContactWindow(due, TZ), false);
    assert.equal(isWithinContactWindow(next, TZ), true);
    assert.ok(next.getTime() > due.getTime());
  });

  it("moves Sunday outbound to Monday window", () => {
    const sunday = new Date("2026-08-23T08:00:00.000Z"); // Sunday 10:00 CAT
    const next = nextContactInstant(sunday, TZ);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(next);
    assert.equal(weekday, "Mon");
  });
});

describe("opt-out and commitments", () => {
  it("detects stop messaging me", () => {
    assert.equal(isProactiveOptOutMessage("Stop messaging me."), true);
    assert.equal(isProactiveOptOutMessage("Don't contact me again"), true);
    assert.equal(isProactiveOptOutMessage("remove me"), true);
    assert.equal(isProactiveOptOutMessage("Thanks, I'll review it"), false);
  });

  it("does not guess payday", () => {
    assert.equal(isAmbiguousCommitment("Contact me after payday"), true);
    assert.equal(isAmbiguousCommitment("Follow up next Friday"), false);
  });
});

describe("fingerprints", () => {
  it("deduplicates the same quote sent event", () => {
    const a = eventFingerprint({
      clientId: "co-a",
      type: "quotation.sent",
      entityId: "q1",
      idempotencyKey: "sent:q1:rev1",
    });
    const b = eventFingerprint({
      clientId: "co-a",
      type: "quotation.sent",
      entityId: "q1",
      idempotencyKey: "sent:q1:rev1",
    });
    assert.equal(a, b);
  });

  it("keeps tenants isolated", () => {
    const a = jobFingerprint({
      clientId: "co-a",
      triggerType: "quotation.followup_due",
      entityId: "q1",
      attemptNumber: 1,
    });
    const b = jobFingerprint({
      clientId: "co-b",
      triggerType: "quotation.followup_due",
      entityId: "q1",
      attemptNumber: 1,
    });
    assert.notEqual(a, b);
  });
});

describe("quotation follow-up policy", () => {
  it("allows a valid first follow-up", () => {
    const result = evaluateProactivePolicy(baseInput());
    assert.equal(result.allowed, true);
    assert.equal(result.actionMode, "CUSTOMER_MESSAGE");
  });

  it("skips when the customer already replied", () => {
    const result = evaluateProactivePolicy(baseInput({ customerRepliedAfterQuoteSend: true }));
    assert.equal(result.allowed, false);
    assert.equal(result.reasonCode, "CUSTOMER_ALREADY_RESPONDED");
    assert.equal(result.terminalStatus, "SKIPPED");
  });

  it("skips recent human contact", () => {
    const result = evaluateProactivePolicy(baseInput({ humanContactedAfterQuoteSend: true }));
    assert.equal(result.reasonCode, "RECENT_HUMAN_CONTACT");
  });

  it("skips accepted quotes without marking Deal Won", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        quotation: {
          ...baseInput().quotation!,
          status: "accepted",
        },
      })
    );
    assert.equal(result.reasonCode, "QUOTE_ACCEPTED");
  });

  it("skips declined quotes", () => {
    const result = evaluateProactivePolicy(
      baseInput({ quotation: { ...baseInput().quotation!, status: "rejected" } })
    );
    assert.equal(result.reasonCode, "QUOTE_DECLINED");
  });

  it("skips superseded versions", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        quotation: { ...baseInput().quotation!, supersededById: "q-v2", status: "superseded" },
      })
    );
    assert.equal(result.reasonCode, "QUOTE_SUPERSEDED");
  });

  it("skips when a later customer follow-up exists", () => {
    const result = evaluateProactivePolicy(
      baseInput({ lead: { ...baseInput().lead, followUpDate: "2026-08-28" } })
    );
    assert.equal(result.reasonCode, "CUSTOMER_REQUESTED_LATER_DATE");
  });

  it("creates a task after max attempts instead of a third message", () => {
    const result = evaluateProactivePolicy(baseInput({ job: { ...baseInput().job, attemptNumber: 3 } }));
    assert.equal(result.allowed, true);
    assert.equal(result.actionMode, "CREATE_TASK");
    assert.equal(result.reasonCode, "MAX_ATTEMPTS_REACHED");
  });

  it("never lets the model override opt-out", () => {
    const result = evaluateProactivePolicy(
      baseInput({ contact: { id: "c1", name: "Tendai", doNotContact: true, marketingSuppressed: false } })
    );
    assert.equal(result.reasonCode, "CUSTOMER_OPTED_OUT");
    assert.equal(result.actionMode, "NO_ACTION");
  });

  it("suppresses sales follow-up during support", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        support: { openCase: true, openHighPriority: true },
      })
    );
    assert.equal(result.reasonCode, "ACTIVE_SUPPORT_ESCALATION");
  });

  it("skips when the agent is paused", () => {
    const result = evaluateProactivePolicy(
      baseInput({ conversation: { ...baseInput().conversation, status: "PAUSED" } })
    );
    assert.equal(result.reasonCode, "AGENT_PAUSED");
  });

  it("skips when a human has taken over", () => {
    const result = evaluateProactivePolicy(
      baseInput({ conversation: { ...baseInput().conversation, humanTakeover: true, status: "HUMAN_HANDLING" } })
    );
    assert.equal(result.reasonCode, "HUMAN_ACTIVE");
  });

  it("does not send while WhatsApp is down", () => {
    const result = evaluateProactivePolicy(baseInput({ channel: { connected: false, status: "DISCONNECTED" } }));
    assert.equal(result.reasonCode, "CHANNEL_UNAVAILABLE");
    assert.equal(result.terminalStatus, undefined);
  });

  it("expires stale actions", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        now: new Date("2026-08-30T08:00:00.000Z"),
        job: { ...baseInput().job, staleAfter: "2026-08-27T08:00:00.000Z" },
      })
    );
    assert.equal(result.reasonCode, "STALE_ACTION");
    assert.equal(result.terminalStatus, "EXPIRED");
  });

  it("blocks pending approval quotes", () => {
    const result = evaluateProactivePolicy(
      baseInput({ quotation: { ...baseInput().quotation!, status: "pending_approval" } })
    );
    assert.equal(result.reasonCode, "QUOTE_PENDING_APPROVAL");
  });

  it("does not send in Assist mode", () => {
    const result = evaluateProactivePolicy(baseInput({ agent: agent({ autonomyMode: "ASSIST" }) }));
    assert.equal(result.actionMode, "REQUEST_APPROVAL");
    assert.equal(result.reasonCode, "AUTONOMY_ASSIST");
  });

  it("records shadow mode instead of sending", () => {
    const result = evaluateProactivePolicy(baseInput({ proactive: proactive({ shadowMode: true }) }));
    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, "SHADOW_MODE");
  });

  it("company kill switch skips", () => {
    const result = evaluateProactivePolicy(baseInput({ proactive: proactive({ enabled: false }) }));
    assert.equal(result.reasonCode, "PROACTIVE_DISABLED");
  });

  it("platform kill switch skips", () => {
    const result = evaluateProactivePolicy(baseInput({ platformProactiveDisabled: true }));
    assert.equal(result.reasonCode, "PLATFORM_DISABLED");
  });

  it("closed deal skips sales follow-up", () => {
    const result = evaluateProactivePolicy(
      baseInput({ deal: { ...baseInput().deal!, stage: "WON" } })
    );
    assert.equal(result.reasonCode, "DEAL_CLOSED");
  });
});

describe("deal inactivity", () => {
  it("creates a task for an inactive negotiating deal", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        job: { ...baseInput().job, triggerType: TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE },
        deal: { ...baseInput().deal!, stage: "NEGOTIATING" },
      })
    );
    assert.equal(result.allowed, true);
    assert.equal(result.actionMode, "CREATE_TASK");
  });

  it("skips inactivity when a site visit is scheduled", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        job: { ...baseInput().job, triggerType: TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE },
        deal: { ...baseInput().deal!, stage: "NEGOTIATING" },
        upcomingAppointmentAt: "2026-08-27T08:00:00.000Z",
      })
    );
    assert.equal(result.reasonCode, "DEAL_HAS_FUTURE_APPOINTMENT");
  });
});

describe("appointments", () => {
  it("allows a future customer reminder", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        job: { ...baseInput().job, triggerType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE },
        appointment: { id: "a1", callbackAt: "2026-08-27T08:00:00.000Z", purpose: "solar site assessment" },
      })
    );
    assert.equal(result.allowed, true);
    assert.equal(result.actionMode, "CUSTOMER_MESSAGE");
  });

  it("expires a reminder after the appointment", () => {
    const result = evaluateProactivePolicy(
      baseInput({
        now: new Date("2026-08-27T10:00:00.000Z"),
        job: { ...baseInput().job, triggerType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE },
        appointment: { id: "a1", callbackAt: "2026-08-27T08:00:00.000Z", purpose: "site assessment" },
      })
    );
    assert.equal(result.reasonCode, "STALE_ACTION");
    assert.equal(result.terminalStatus, "EXPIRED");
  });
});

describe("messages", () => {
  it("uses known facts only", () => {
    const text = quoteFollowUpFallback({
      customerFirstName: "Tendai",
      quoteNumber: "Q-0042",
      projectHint: "solar",
    });
    assert.match(text, /Tendai/);
    assert.match(text, /Q-0042/);
    assert.doesNotMatch(text, /last chance/i);
  });

  it("appointment reminder includes real time", () => {
    const text = appointmentReminderMessage({
      customerFirstName: "Tendai",
      purpose: "solar site assessment",
      callbackAtIso: "2026-08-26T08:00:00.000Z",
      timezone: TZ,
    });
    assert.match(text, /solar site assessment/);
    assert.match(text, /Tendai/);
  });

  it("strips false urgency", () => {
    const text = sanitizeProactiveMessage("This is your last chance! Please review.");
    assert.doesNotMatch(text, /last chance/i);
  });

  it("commitment copy is direct", () => {
    const text = quoteFollowUpFallback({
      customerFirstName: "Tendai",
      quoteNumber: "Q-0042",
      projectHint: null,
      commitment: true,
    });
    assert.match(text, /asked us to follow up/i);
  });
});

describe("clock injection", () => {
  it("freezes now()", () => {
    setClockTo("2026-08-24T08:00:00.000Z");
    assert.equal(now().toISOString(), "2026-08-24T08:00:00.000Z");
  });
});
