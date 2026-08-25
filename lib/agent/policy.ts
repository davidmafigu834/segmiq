import { resolveWorkdayState, type OperatingHours } from "@/lib/sales/intelligence/operating-hours";
import type {
  AgentCompanySettings,
  AgentEscalationReason,
  AgentPolicyDecision,
  AgentRiskLevel,
} from "./types";

/**
 * Server-side policy enforcement for agent tool calls.
 * The model proposes; this module (never the model) decides.
 */

export type AgentToolMetadata = {
  name: string;
  riskLevel: AgentRiskLevel;
  /** Capability toggle on AgentCompanySettings that must be ON, if any. */
  capability?: keyof Pick<
    AgentCompanySettings,
    | "respondToEnquiries"
    | "qualifyLeads"
    | "createLeads"
    | "createDeals"
    | "createTasks"
    | "scheduleCallbacks"
    | "scheduleAppointments"
    | "rescheduleAppointments"
    | "prepareQuotations"
    | "sendQuotations"
    | "sendFollowUps"
    | "transferSupport"
    | "createSupportCases"
    | "negotiateDiscounts"
  >;
  /** True when the tool sends customer-visible communication. */
  customerVisible: boolean;
  /** True when the effect can be undone by a human without customer impact. */
  reversible: boolean;
  /** Read-only tools are allowed in every mode, including ASSIST. */
  readOnly: boolean;
};

const HUMAN_LABELS: Record<AgentRiskLevel, string> = {
  LOW: "low-risk",
  MEDIUM: "medium-risk",
  HIGH: "high-risk",
  VERY_HIGH: "restricted",
};

/**
 * Decide whether a tool may run under the company's autonomy policy.
 *
 * ASSIST    — read-only tools plus internal escalation/notes only.
 * COPILOT   — LOW and MEDIUM risk tools whose capability toggle is on.
 * AUTOPILOT — additionally HIGH risk tools whose capability toggle is on.
 * VERY_HIGH — never autonomous, in any mode (MVP hard rule).
 */
export function evaluateToolPolicy(
  tool: AgentToolMetadata,
  settings: AgentCompanySettings
): AgentPolicyDecision {
  if (tool.riskLevel === "VERY_HIGH") {
    return {
      allowed: false,
      reason: `${tool.name} is a restricted action the agent may never perform autonomously.`,
      escalate: "POLICY_BLOCKED",
    };
  }

  if (tool.capability && !settings[tool.capability]) {
    return {
      allowed: false,
      reason: `Company settings disable this capability (${String(tool.capability)}).`,
    };
  }

  if (tool.readOnly) return { allowed: true };

  switch (settings.autonomyMode) {
    case "ASSIST":
      return {
        allowed: false,
        reason: `Autonomy mode ASSIST only allows drafting; ${HUMAN_LABELS[tool.riskLevel]} action ${tool.name} needs a human.`,
      };
    case "COPILOT":
      if (tool.riskLevel === "HIGH") {
        return {
          allowed: false,
          reason: `Autonomy mode COPILOT does not permit ${HUMAN_LABELS[tool.riskLevel]} action ${tool.name}.`,
        };
      }
      return { allowed: true };
    case "AUTOPILOT":
      return { allowed: true };
  }
}

/** Whether the final customer reply may be sent (vs drafted for review). */
export function canSendCustomerReply(settings: AgentCompanySettings): boolean {
  return settings.autonomyMode !== "ASSIST";
}

export type QuoteAutoSendCheck = {
  total: number;
  commercialCheckPassed: boolean;
  approvalRequired: boolean;
  connectionHealthy: boolean;
};

/**
 * Autonomous quotation send gate — every condition must hold.
 * The canonical Commercial Check / approval engine results are inputs here;
 * the agent can never override them.
 */
export function evaluateQuoteAutoSend(
  check: QuoteAutoSendCheck,
  settings: AgentCompanySettings
): AgentPolicyDecision {
  if (!settings.sendQuotations) {
    return { allowed: false, reason: "Autonomous quotation sending is disabled for this company." };
  }
  if (settings.autonomyMode !== "AUTOPILOT") {
    return {
      allowed: false,
      reason: `Quotation sending requires AUTOPILOT mode (current: ${settings.autonomyMode}).`,
    };
  }
  if (!check.commercialCheckPassed) {
    return {
      allowed: false,
      reason: "Commercial Check has blocking items.",
      escalate: "COMMERCIAL_APPROVAL",
    };
  }
  if (check.approvalRequired) {
    return {
      allowed: false,
      reason: "Company approval policy requires human approval for this quotation.",
      escalate: "COMMERCIAL_APPROVAL",
    };
  }
  if (settings.quoteAutoSendLimit == null || !(settings.quoteAutoSendLimit > 0)) {
    return { allowed: false, reason: "No autonomous quotation value limit is configured." };
  }
  if (check.total > settings.quoteAutoSendLimit) {
    return {
      allowed: false,
      reason: `Quotation total ${check.total} exceeds the autonomous send limit of ${settings.quoteAutoSendLimit}.`,
    };
  }
  if (!check.connectionHealthy) {
    return { allowed: false, reason: "WhatsApp connection is not healthy." };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Business hours.

export type BusinessHoursDecision = "RESPOND" | "AFTER_HOURS_ACK" | "SUPPRESS";

const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 18;

function localHourAndDay(now: Date, timezone: string): { hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "12";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { hour: Number(hourPart) % 24, weekday: weekdays.indexOf(weekdayPart) };
}

export function evaluateBusinessHours(
  settings: Pick<AgentCompanySettings, "businessHoursPolicy">,
  timezone: string,
  now = new Date(),
  hours?: OperatingHours
): BusinessHoursDecision {
  if (settings.businessHoursPolicy === "ALWAYS") return "RESPOND";
  if (hours) {
    const state = resolveWorkdayState(now, timezone, hours);
    if (state.withinHours) return "RESPOND";
    return settings.businessHoursPolicy === "AFTER_HOURS_ACK" ? "AFTER_HOURS_ACK" : "SUPPRESS";
  }
  const { hour, weekday } = localHourAndDay(now, timezone);
  const withinHours = weekday >= 1 && weekday <= 6 && hour >= DEFAULT_OPEN_HOUR && hour < DEFAULT_CLOSE_HOUR;
  if (withinHours) return "RESPOND";
  return settings.businessHoursPolicy === "AFTER_HOURS_ACK" ? "AFTER_HOURS_ACK" : "SUPPRESS";
}

// ---------------------------------------------------------------------------
// Escalation classification helpers used by the runtime.

export function escalationSeverity(reason: AgentEscalationReason): "LOW" | "MEDIUM" | "HIGH" {
  switch (reason) {
    case "COMPLAINT":
    case "PRICING_DISPUTE":
    case "SYSTEM_FAILURE":
      return "HIGH";
    case "LOW_CONFIDENCE":
    case "ATTACHMENT_REVIEW":
      return "LOW";
    default:
      return "MEDIUM";
  }
}
