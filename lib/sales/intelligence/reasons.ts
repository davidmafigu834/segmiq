import type { SalesActionReasonCode, SalesActionType } from "./types";

const REASON_TEMPLATES: Record<
  SalesActionReasonCode,
  (ctx?: Record<string, string | number | null | undefined>) => string
> = {
  HIGH_INTENT_NEW_LEAD: (ctx) => {
    const age = ctx?.ageLabel ? ` received ${ctx.ageLabel}` : "";
    const source = ctx?.sourceLabel ? ` (${ctx.sourceLabel})` : "";
    return `High-intent new enquiry${source}${age}. No first response has been recorded.`;
  },
  CUSTOMER_WAITING: (ctx) => {
    const who = ctx?.name ? String(ctx.name) : "The customer";
    const age = ctx?.ageLabel ? ` ${ctx.ageLabel}` : "";
    return `${who} is waiting for your response${age}.`;
  },
  FOLLOWUP_OVERDUE: (ctx) => {
    const overdue = ctx?.overdueLabel ? ` by ${ctx.overdueLabel}` : "";
    return `Your planned follow-up is overdue${overdue}.`;
  },
  FOLLOWUP_DUE_TODAY: () => "You planned to follow up today.",
  QUOTE_WAITING: (ctx) => {
    const age = ctx?.ageLabel ? ` ${ctx.ageLabel}` : "";
    return `The quotation is still open${age} and no next follow-up is scheduled.`;
  },
  QUOTE_APPROVAL_NEEDED: () => "This quotation needs commercial approval before it can be sent.",
  QUOTE_EXPIRING: () => "This quotation expires soon and the customer has not responded.",
  QUOTE_VIEWED: () => "The customer viewed the quotation. Follow up while it is still in front of them.",
  QUOTE_CUSTOMER_CHANGES: () => "The customer requested quotation changes. Review the request and create a revision.",
  DEAL_STALE: (ctx) => {
    const age = ctx?.ageLabel ? ` for ${ctx.ageLabel}` : "";
    return `This active opportunity has had no meaningful activity${age}.`;
  },
  NO_NEXT_ACTION: () =>
    "This opportunity is active but nothing is scheduled next.",
  LATE_STAGE_NEEDS_ACTION: () =>
    "This late-stage opportunity needs a decision-making conversation or follow-up.",
  GOAL_PIPELINE_LOW: () =>
    "Your active pipeline is below the level currently needed to support your goal.",
  SCHEDULED_TODAY: () => "This sales activity is scheduled for today.",
  MANAGER_ASSIGNED: () => "Assigned by your manager and due for attention.",
  PROSPECTING_COMMITMENT: () =>
    "Your priority deal queue is clear. Create new opportunities today.",
};

export function reasonText(
  code: SalesActionReasonCode,
  ctx?: Record<string, string | number | null | undefined>
): string {
  const template = REASON_TEMPLATES[code];
  if (!template) return "";
  return template(ctx);
}

export function actionTypeLabel(type: SalesActionType): string {
  switch (type) {
    case "CONTACT_NEW_LEAD":
      return "Contact new lead";
    case "RESPOND_TO_CUSTOMER":
      return "Reply to customer";
    case "COMPLETE_FOLLOW_UP":
      return "Follow up";
    case "FOLLOW_UP_QUOTE":
      return "Follow up quotation";
    case "FOLLOW_UP_NEGOTIATION":
      return "Follow up negotiation";
    case "REENGAGE_STALE_DEAL":
      return "Re-engage opportunity";
    case "COMPLETE_SCHEDULED_CALL":
      return "Complete scheduled call";
    case "COMPLETE_APPOINTMENT":
      return "Complete appointment";
    case "CREATE_QUOTE":
      return "Create quotation";
    case "SCHEDULE_NEXT_ACTION":
      return "Schedule next action";
    case "PROSPECT_NEW_CUSTOMERS":
      return "Add new prospects";
    case "LOG_OUTREACH":
      return "Log outreach";
    case "ADD_VALID_PROSPECT":
      return "Add prospect";
    case "MANUAL_TASK":
      return "Personal task";
    case "MANAGER_ASSIGNED_TASK":
      return "Assigned task";
    default:
      return "Sales action";
  }
}

export function originLabel(origin: string): string {
  switch (origin) {
    case "USER_CREATED":
      return "Personal";
    case "MANAGER_ASSIGNED":
      return "Assigned";
    case "SYSTEM_RECOMMENDED":
      return "Recommended by SegmiQ";
    case "GOAL_COMMITMENT":
      return "Goal activity";
    default:
      return "Task";
  }
}

export function focusModeCopy(mode: "BUILD" | "MOVE" | "CLOSE"): { title: string; eyebrow: string } {
  if (mode === "BUILD") {
    return { eyebrow: "Today's focus", title: "Build pipeline" };
  }
  if (mode === "CLOSE") {
    return { eyebrow: "Today's focus", title: "Close opportunities" };
  }
  return { eyebrow: "Today's focus", title: "Move deals" };
}
