/**
 * Map Daily Plan recommendations → Sales Attention items.
 * Deterministic whyNow from reason codes — model may phrase later, not invent.
 */

import type { SalesActionRecommendation } from "@/lib/sales/intelligence/types";
import {
  attentionTypeFromReason,
  attentionTypeLabel,
  priorityClassForReason,
  suggestedActionFromAttention,
} from "./priority";
import { formatWaitingDuration } from "./customer-waiting";
import type { FocusAction, SalesAttentionItem } from "./types";

function buildActions(rec: SalesActionRecommendation, type: SalesAttentionItem["type"]): FocusAction[] {
  const leadId = rec.customer?.leadId ?? null;
  const dealId =
    typeof rec.metadata?.dealId === "string"
      ? rec.metadata.dealId
      : rec.sourceEntityType === "deal"
        ? rec.sourceEntityId
        : null;
  const quotationId =
    typeof rec.metadata?.quotationId === "string" ? rec.metadata.quotationId : null;

  const actions: FocusAction[] = [];

  if (type === "CUSTOMER_WAITING" || type === "NEW_LEAD_CONTACT") {
    if (type === "NEW_LEAD_CONTACT") {
      actions.push({
        kind: "draft_and_send",
        label: "Draft reply",
        prompt: "Draft a first reply for this new enquiry.",
        primary: true,
      });
      actions.push({
        kind: "summarize",
        label: "Summarize",
        prompt: "Summarize what this new enquiry is asking for.",
      });
      if (leadId) {
        actions.push({
          kind: "open_whatsapp",
          label: "Open WhatsApp",
          href: `/sales/whatsapp?lead=${leadId}`,
        });
      }
    } else {
      if (rec.availableActions.includes("whatsapp") && leadId) {
        actions.push({
          kind: "open_whatsapp",
          label: "Open WhatsApp",
          href: `/sales/whatsapp?lead=${leadId}`,
          primary: true,
        });
      }
      actions.push({
        kind: "draft_message",
        label: "Draft message",
        prompt: "Draft a reply for this customer.",
      });
      if (/quot/i.test(rec.reason) || /quot/i.test(rec.subtitle ?? "") || /quot/i.test(rec.title)) {
        actions.push({
          kind: "prepare_quotation",
          label: "Prepare quotation",
          href: `/sales/command?view=focus&action=quote${leadId ? `&lead=${leadId}` : ""}`,
          prompt: leadId ? "Create a quotation for this customer." : "Create a quotation.",
          primary: true,
        });
      }
    }
  }

  if (
    type === "FOLLOWUP_DUE" ||
    type === "FOLLOWUP_OVERDUE" ||
    type === "QUOTE_FOLLOWUP_DUE" ||
    type === "DEAL_INACTIVE" ||
    type === "DEAL_NEEDS_PROGRESS"
  ) {
    actions.push({
      kind: "draft_message",
      label: "Draft message",
      prompt: "Draft a follow-up message for this customer.",
      primary: true,
    });
    if (leadId) {
      actions.push({
        kind: "open_whatsapp",
        label: "Open WhatsApp",
        href: `/sales/whatsapp?lead=${leadId}`,
      });
    }
  }

  if (type === "QUOTE_REVISION_REQUESTED") {
    actions.push({
      kind: "revise_quotation",
      label: "Revise quotation",
      href: quotationId ? `/sales/quotes/${quotationId}` : "/sales/command",
      prompt: "Prepare a revised quotation based on the customer's request.",
      primary: true,
    });
  }

  if (type === "QUOTE_APPROVAL_REQUIRED" && quotationId) {
    actions.push({
      kind: "view_quotation",
      label: "Request approval",
      href: `/sales/quotes/${quotationId}`,
      primary: true,
    });
  }

  if (type === "DEAL_NO_NEXT_ACTION") {
    actions.push({
      kind: "create_task",
      label: "Create task",
      href: dealId ? `/sales/deals/${dealId}` : "/sales/tasks",
      primary: true,
    });
    actions.push({
      kind: "draft_message",
      label: "Draft customer update",
      prompt: "Draft a short update for this customer.",
    });
  }

  if (type === "APPOINTMENT_TODAY" || type === "APPOINTMENT_PREP") {
    if (leadId) {
      actions.push({
        kind: "view_lead",
        label: "Open customer",
        href: `/sales/leads/${leadId}`,
        primary: true,
      });
      actions.push({
        kind: "open_whatsapp",
        label: "Open WhatsApp",
        href: `/sales/whatsapp?lead=${leadId}`,
      });
    }
    actions.push({
      kind: "view_appointment",
      label: "View appointment",
      href: "/sales/calendar",
    });
  }

  if (dealId) {
    actions.push({
      kind: "view_deal",
      label: "View Deal",
      href: `/sales/deals/${dealId}`,
    });
  } else if (leadId && !actions.some((a) => a.kind === "view_lead" || a.kind === "open_whatsapp")) {
    actions.push({
      kind: "view_lead",
      label: "Open lead",
      href: `/sales/leads/${leadId}`,
    });
  }

  if (rec.availableActions.includes("call") && !actions.some((a) => a.kind === "call")) {
    actions.push({ kind: "call", label: "Call", href: leadId ? `/sales/leads/${leadId}` : undefined });
  }

  actions.push({ kind: "snooze", label: "Snooze" });
  actions.push({ kind: "done", label: "Done" });

  // Deduplicate by kind
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.kind)) return false;
    seen.add(a.kind);
    return true;
  });
}

function suggestedSummary(rec: SalesActionRecommendation, type: SalesAttentionItem["type"]): string {
  if (rec.recommendedActionLabel) {
    switch (type) {
      case "CUSTOMER_WAITING":
        return "Reply to the customer and resolve what they asked for.";
      case "FOLLOWUP_DUE":
      case "FOLLOWUP_OVERDUE":
        return "Check in as agreed and clarify any remaining questions.";
      case "QUOTE_FOLLOWUP_DUE":
        return "Check whether they reviewed the quotation and offer to clarify anything.";
      case "QUOTE_REVISION_REQUESTED":
        return "Revise the quotation using the canonical revision workflow.";
      case "QUOTE_APPROVAL_REQUIRED":
        return "Request commercial approval before sending.";
      case "QUOTE_EXPIRING":
        return "Review whether a follow-up is appropriate before the quotation expires.";
      case "DEAL_NO_NEXT_ACTION":
        return "Schedule the next step or create a task before this Deal stalls.";
      case "DEAL_INACTIVE":
      case "DEAL_NEEDS_PROGRESS":
        return "Re-engage with a grounded follow-up based on the last discussion.";
      case "APPOINTMENT_TODAY":
        return "Review customer context and confirm what you need to accomplish in the meeting.";
      case "NEW_LEAD_CONTACT":
        return "Review the enquiry, then draft a first reply if helpful.";
      case "CUSTOMER_WAITING":
        return "Reply in the active sales thread — this customer is mid-conversation with you.";
      case "PROSPECTING":
        return "Add valid prospects to rebuild pipeline coverage.";
      default:
        return rec.recommendedActionLabel;
    }
  }
  return "Take the next sales step.";
}

export function mapRecommendationToAttentionItem(opts: {
  rec: SalesActionRecommendation;
  companyId: string;
  salespersonId: string;
}): SalesAttentionItem {
  const { rec, companyId, salespersonId } = opts;
  const type = attentionTypeFromReason(rec.reasonCode, rec.actionType);
  const priorityClass = priorityClassForReason(rec.reasonCode, rec.actionType);
  const suggestedActionType = suggestedActionFromAttention(type, rec.actionType);
  const leadId = rec.customer?.leadId ?? null;
  const dealId =
    typeof rec.metadata?.dealId === "string"
      ? rec.metadata.dealId
      : rec.sourceEntityType === "deal"
        ? rec.sourceEntityId
        : null;
  const quotationId =
    typeof rec.metadata?.quotationId === "string" ? rec.metadata.quotationId : null;

  const waitingMinutes =
    typeof rec.metadata?.waitingMinutes === "number"
      ? rec.metadata.waitingMinutes
      : rec.reasonCode === "CUSTOMER_WAITING" && rec.urgencyLabel
        ? null
        : null;

  const whyNow = rec.reason || attentionTypeLabel(type);

  return {
    id: rec.id,
    fingerprint: rec.idempotencyKey,
    companyId,
    salespersonId,
    type,
    priorityClass,
    internalScore: rec.attentionScore,
    title: rec.title,
    subtitle: rec.subtitle,
    reasonCode: rec.reasonCode,
    reasonSummary: whyNow,
    whyNow,
    suggestedActionType,
    suggestedActionSummary: suggestedSummary(rec, type),
    customerName: rec.customer?.name ?? null,
    leadId,
    dealId,
    conversationId: leadId,
    quotationId,
    quotationLabel:
      typeof rec.metadata?.quoteNumber === "string"
        ? String(rec.metadata.quoteNumber)
        : rec.subtitle && /Q-\d+/i.test(rec.subtitle)
          ? rec.subtitle
          : null,
    taskId: null,
    appointmentId: null,
    dealStage: rec.customer?.status ? String(rec.customer.status) : null,
    projectType: rec.customer?.projectType ?? null,
    phone: rec.customer?.phone ?? null,
    dueAt: rec.dueAt,
    waitingMinutes,
    inactivityDays: null,
    state: "OPEN",
    snoozedUntil: null,
    actions: buildActions(rec, type),
    availableContactActions: rec.availableActions,
    sourceActionType: rec.actionType,
    metadata: {
      ...rec.metadata,
      urgencyLabel: rec.urgencyLabel,
      waitingLabel:
        waitingMinutes != null ? formatWaitingDuration(waitingMinutes) : rec.urgencyLabel,
    },
  };
}

export function summarizeAttentionCounts(items: SalesAttentionItem[]) {
  return {
    total: items.length,
    immediate: items.filter((i) => i.priorityClass === "IMMEDIATE").length,
    today: items.filter((i) => i.priorityClass === "TODAY").length,
    needsProgress: items.filter((i) => i.priorityClass === "NEEDS_PROGRESS").length,
    watch: items.filter((i) => i.priorityClass === "WATCH").length,
  };
}
