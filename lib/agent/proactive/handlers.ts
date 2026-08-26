import { now } from "@/lib/clock";
import { addBusinessDays } from "./business-days";
import { nextContactInstant } from "./contact-window";
import { cancelJobs, scheduleEvaluation } from "./jobs";
import { DOMAIN_EVENT_TYPES, TEMPORAL_TRIGGER_TYPES } from "./registry";
import { getProactiveSettings } from "./settings";
import type { DomainEvent } from "./types";
import { getAgentCompanySettings } from "@/lib/agent/settings";
import { loadCachedCompanyBrainSnapshot } from "@/lib/company-brain";

const QUOTE_FOLLOWUP_TRIGGERS = [
  TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
  TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON,
];

/**
 * Domain event → schedule future evaluations / invalidate existing ones.
 * Never sends a customer message from here.
 */
export async function handleDomainEvent(event: DomainEvent): Promise<void> {
  // Agent-origin conversation events must not start a new customer-facing cadence.
  if (
    event.actorType === "AGENT" &&
    (event.type === DOMAIN_EVENT_TYPES.CONVERSATION_AGENT_MESSAGE ||
      event.type === DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE)
  ) {
    return;
  }

  switch (event.type) {
    case DOMAIN_EVENT_TYPES.QUOTATION_SENT:
      await onQuotationSent(event);
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_ACCEPTED:
      await cancelQuoteCadence(event, "QUOTE_ACCEPTED");
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_DECLINED:
      await cancelQuoteCadence(event, "QUOTE_DECLINED");
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_SUPERSEDED:
      await cancelQuoteCadence(event, "QUOTE_SUPERSEDED");
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_EXPIRED:
      await cancelQuoteCadence(event, "QUOTE_EXPIRED");
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_CHANGE_REQUESTED:
      await cancelQuoteCadence(event, "CUSTOMER_REQUESTED_LATER_DATE");
      return;
    case DOMAIN_EVENT_TYPES.QUOTATION_VIEWED:
      // Engagement signal only — never an immediate customer message.
      return;
    case DOMAIN_EVENT_TYPES.CONVERSATION_CUSTOMER_MESSAGE:
      await cancelJobs({
        clientId: event.clientId,
        leadId: event.entityId,
        triggerTypes: QUOTE_FOLLOWUP_TRIGGERS,
        reason: "CUSTOMER_ALREADY_RESPONDED",
      });
      await maybeScheduleSla(event);
      return;
    case DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE:
      await cancelJobs({
        clientId: event.clientId,
        leadId: event.entityId,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE],
        reason: "RECENT_HUMAN_CONTACT",
      });
      await cancelJobs({
        clientId: event.clientId,
        leadId: event.entityId,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA],
        reason: "NO_ACTION_NEEDED",
      });
      return;
    case DOMAIN_EVENT_TYPES.CUSTOMER_COMMITMENT:
      await cancelJobs({
        clientId: event.clientId,
        leadId: (event.payload.leadId as string) ?? event.entityId,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE],
        reason: "CUSTOMER_REQUESTED_LATER_DATE",
      });
      await scheduleCustomerFollowUp(event);
      return;
    case DOMAIN_EVENT_TYPES.CUSTOMER_OPTED_OUT:
      await cancelJobs({
        clientId: event.clientId,
        leadId: (event.payload.leadId as string) || undefined,
        reason: "CUSTOMER_OPTED_OUT",
      });
      return;
    case DOMAIN_EVENT_TYPES.APPOINTMENT_CREATED:
      await scheduleAppointmentReminders(event);
      await cancelJobs({
        clientId: event.clientId,
        dealId: (event.payload.dealId as string) || undefined,
        leadId: (event.payload.leadId as string) || undefined,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE, TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING],
        reason: "DEAL_HAS_FUTURE_APPOINTMENT",
      });
      return;
    case DOMAIN_EVENT_TYPES.APPOINTMENT_RESCHEDULED:
      await cancelJobs({
        clientId: event.clientId,
        appointmentId: event.entityId,
        reason: "Appointment rescheduled",
      });
      await scheduleAppointmentReminders(event);
      return;
    case DOMAIN_EVENT_TYPES.APPOINTMENT_CANCELLED:
      await cancelJobs({
        clientId: event.clientId,
        appointmentId: event.entityId,
        reason: "Appointment cancelled",
      });
      return;
    case DOMAIN_EVENT_TYPES.APPOINTMENT_COMPLETED:
      await cancelJobs({
        clientId: event.clientId,
        appointmentId: event.entityId,
        triggerTypes: [
          TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE,
          TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER,
        ],
        reason: "Appointment completed",
      });
      await schedulePostAppointment(event, "completed");
      return;
    case DOMAIN_EVENT_TYPES.APPOINTMENT_MISSED:
      await cancelJobs({
        clientId: event.clientId,
        appointmentId: event.entityId,
        triggerTypes: [
          TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE,
          TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER,
        ],
        reason: "Appointment missed",
      });
      await schedulePostAppointment(event, "missed");
      return;
    case DOMAIN_EVENT_TYPES.DEAL_CREATED:
    case DOMAIN_EVENT_TYPES.DEAL_STAGE_CHANGED:
    case DOMAIN_EVENT_TYPES.DEAL_REOPENED:
      await scheduleDealWatch(event);
      return;
    case DOMAIN_EVENT_TYPES.DEAL_CLOSED:
      await cancelJobs({
        clientId: event.clientId,
        dealId: event.entityId,
        reason: "DEAL_CLOSED",
      });
      await cancelJobs({
        clientId: event.clientId,
        leadId: (event.payload.leadId as string) || undefined,
        triggerTypes: QUOTE_FOLLOWUP_TRIGGERS,
        reason: "DEAL_CLOSED",
      });
      return;
    case DOMAIN_EVENT_TYPES.SUPPORT_CASE_CREATED:
      await cancelJobs({
        clientId: event.clientId,
        leadId: (event.payload.leadId as string) || undefined,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE],
        reason: "ACTIVE_SUPPORT_ESCALATION",
      });
      return;
    case DOMAIN_EVENT_TYPES.TASK_CREATED:
      await cancelJobs({
        clientId: event.clientId,
        leadId: (event.payload.leadId as string) || event.entityId,
        triggerTypes: [TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING],
        reason: "DEAL_HAS_NEXT_ACTION",
      });
      return;
    case DOMAIN_EVENT_TYPES.INVENTORY_LOW_STOCK:
    case DOMAIN_EVENT_TYPES.INVENTORY_OUT_OF_STOCK:
      await notifyInventoryManagers(event);
      return;
    default:
      return;
  }
}

async function companyContext(clientId: string) {
  const [proactive, agent, brain] = await Promise.all([
    getProactiveSettings(clientId),
    getAgentCompanySettings(clientId),
    loadCachedCompanyBrainSnapshot(clientId).catch(() => null),
  ]);
  const timezone = brain?.canonical.timezone ?? "Africa/Harare";
  const workingDays = brain?.canonical.workingDays ?? [1, 2, 3, 4, 5];
  return { proactive, agent, timezone, workingDays, brain };
}

async function onQuotationSent(event: DomainEvent): Promise<void> {
  const { proactive, timezone, workingDays, brain } = await companyContext(event.clientId);
  if (!proactive.enabled || !proactive.config.quoteFollowUpEnabled) return;

  const leadId = (event.payload.leadId as string) ?? null;
  const dealId = (event.payload.dealId as string) ?? null;
  const contactId = (event.payload.contactId as string) ?? null;
  const revision = Number(event.payload.revisionNumber) || 1;
  const firstDays = brain?.settings.quoteFollowUpBusinessDays ?? 2;
  const secondDays = brain?.settings.secondFollowUpBusinessDays ?? 5;
  const max = brain?.settings.maxAutonomousFollowUps ?? 2;

  const firstAt = nextContactInstant(
    addBusinessDays({ from: event.occurredAt, days: firstDays, timezone, workingDays }),
    timezone,
    proactive.config.contactWindows
  );
  await scheduleEvaluation({
    clientId: event.clientId,
    leadId,
    contactId,
    dealId,
    quotationId: event.entityId,
    quotationVersion: revision,
    conversationId: leadId,
    triggerType: TEMPORAL_TRIGGER_TYPES.QUOTATION_FOLLOWUP_DUE,
    triggerEventId: event.id ?? null,
    attemptNumber: 1,
    scheduledAt: firstAt,
    staleAfter: new Date(firstAt.getTime() + 36 * 3600_000),
    payload: { maxAttempts: max, secondFollowUpBusinessDays: secondDays },
    actorOrigin: event.actorType,
    correlationId: event.correlationId,
    causationId: event.id,
  });

  const validUntil = event.payload.validUntil as string | undefined;
  if (proactive.config.quoteExpiryNotifySalesperson && validUntil) {
    const expiry = new Date(`${validUntil}T12:00:00.000Z`);
    const hours = proactive.config.quoteExpiryHoursBefore;
    const remindAt = new Date(expiry.getTime() - hours * 3600_000);
    if (remindAt.getTime() > now().getTime()) {
      await scheduleEvaluation({
        clientId: event.clientId,
        leadId,
        dealId,
        quotationId: event.entityId,
        quotationVersion: revision,
        conversationId: leadId,
        triggerType: TEMPORAL_TRIGGER_TYPES.QUOTATION_EXPIRING_SOON,
        triggerEventId: event.id ?? null,
        scheduledAt: remindAt,
        staleAfter: expiry,
        payload: { validUntil },
        actorOrigin: "SYSTEM",
        causationId: event.id,
      });
    }
  }
}

async function cancelQuoteCadence(event: DomainEvent, reason: string): Promise<void> {
  await cancelJobs({
    clientId: event.clientId,
    quotationId: event.entityId,
    reason,
  });
}

async function scheduleCustomerFollowUp(event: DomainEvent): Promise<void> {
  const dueAtIso = event.payload.dueAt as string | undefined;
  const dueDate = event.payload.dueDate as string | undefined;
  const { proactive, timezone } = await companyContext(event.clientId);
  if (!proactive.enabled) return;
  let scheduledAt: Date;
  if (dueAtIso) {
    scheduledAt = new Date(dueAtIso);
  } else if (dueDate) {
    scheduledAt = nextContactInstant(new Date(`${dueDate}T08:00:00.000Z`), timezone, proactive.config.contactWindows);
    // Prefer local 09:00 on that date via contact window.
    scheduledAt = nextContactInstant(new Date(`${dueDate}T07:00:00.000Z`), timezone, proactive.config.contactWindows);
  } else {
    return;
  }
  scheduledAt = nextContactInstant(scheduledAt, timezone, proactive.config.contactWindows);
  const leadId = (event.payload.leadId as string) ?? event.entityId;
  await cancelJobs({
    clientId: event.clientId,
    leadId,
    triggerTypes: [TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE],
    reason: "Latest customer commitment supersedes the previous one.",
  });
  await scheduleEvaluation({
    clientId: event.clientId,
    leadId,
    contactId: (event.payload.contactId as string) ?? null,
    dealId: (event.payload.dealId as string) ?? null,
    quotationId: (event.payload.quotationId as string) ?? null,
    conversationId: leadId,
    triggerType: TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE,
    triggerEventId: event.id ?? null,
    attemptNumber: 1,
    scheduledAt,
    staleAfter: new Date(scheduledAt.getTime() + 36 * 3600_000),
    payload: { source: "CUSTOMER_COMMITMENT", note: event.payload.note ?? null },
    actorOrigin: "CUSTOMER",
    causationId: event.id,
  });
}

async function scheduleAppointmentReminders(event: DomainEvent): Promise<void> {
  const callbackAt = event.payload.callbackAt as string | undefined;
  if (!callbackAt) return;
  const when = new Date(callbackAt);
  const { proactive } = await companyContext(event.clientId);
  if (!proactive.enabled) return;
  const leadId = (event.payload.leadId as string) ?? null;
  if (proactive.config.appointmentCustomerReminder) {
    const hours = proactive.config.appointmentCustomerReminderHours;
    const at = new Date(when.getTime() - hours * 3600_000);
    if (at.getTime() > now().getTime()) {
      await scheduleEvaluation({
        clientId: event.clientId,
        leadId,
        appointmentId: event.entityId,
        conversationId: leadId,
        triggerType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_REMINDER_DUE,
        triggerEventId: event.id ?? null,
        scheduledAt: at,
        staleAfter: when,
        payload: { callbackAt, purpose: event.payload.purpose ?? null },
        actorOrigin: event.actorType,
        causationId: event.id,
      });
    }
  }
  if (proactive.config.appointmentSalespersonReminder) {
    const minutes = proactive.config.appointmentSalespersonReminderMinutes;
    const at = new Date(when.getTime() - minutes * 60_000);
    if (at.getTime() > now().getTime()) {
      await scheduleEvaluation({
        clientId: event.clientId,
        leadId,
        appointmentId: event.entityId,
        conversationId: leadId,
        triggerType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_SALESPERSON_REMINDER,
        triggerEventId: event.id ?? null,
        scheduledAt: at,
        staleAfter: when,
        payload: { callbackAt, purpose: event.payload.purpose ?? null },
        actorOrigin: "SYSTEM",
        causationId: event.id,
      });
    }
  }
}

async function schedulePostAppointment(event: DomainEvent, kind: "completed" | "missed"): Promise<void> {
  const { proactive } = await companyContext(event.clientId);
  if (!proactive.enabled) return;
  await scheduleEvaluation({
    clientId: event.clientId,
    leadId: (event.payload.leadId as string) ?? null,
    dealId: (event.payload.dealId as string) ?? null,
    appointmentId: event.entityId,
    conversationId: (event.payload.leadId as string) ?? null,
    triggerType: TEMPORAL_TRIGGER_TYPES.APPOINTMENT_FOLLOWUP_DUE,
    triggerEventId: event.id ?? null,
    scheduledAt: now(),
    payload: { kind },
    actorOrigin: "SYSTEM",
    causationId: event.id,
  });
}

async function scheduleDealWatch(event: DomainEvent): Promise<void> {
  const { proactive, timezone, workingDays } = await companyContext(event.clientId);
  if (!proactive.enabled || !proactive.config.dealInactivityEnabled) return;
  const due = addBusinessDays({
    from: event.occurredAt,
    days: proactive.config.dealInactivityBusinessDays,
    timezone,
    workingDays,
  });
  await scheduleEvaluation({
    clientId: event.clientId,
    leadId: (event.payload.leadId as string) ?? null,
    dealId: event.entityId,
    conversationId: (event.payload.leadId as string) ?? null,
    triggerType: TEMPORAL_TRIGGER_TYPES.DEAL_INACTIVE,
    triggerEventId: event.id ?? null,
    scheduledAt: due,
    payload: { stage: event.payload.toStage ?? event.payload.stage ?? null },
    actorOrigin: "SYSTEM",
    causationId: event.id,
  });
  if (proactive.config.dealNextActionMissingEnabled) {
    await scheduleEvaluation({
      clientId: event.clientId,
      leadId: (event.payload.leadId as string) ?? null,
      dealId: event.entityId,
      conversationId: (event.payload.leadId as string) ?? null,
      triggerType: TEMPORAL_TRIGGER_TYPES.DEAL_NEXT_ACTION_MISSING,
      triggerEventId: event.id ?? null,
      scheduledAt: new Date(event.occurredAt.getTime() + 60 * 60_000),
      payload: {},
      actorOrigin: "SYSTEM",
      causationId: event.id,
    });
  }
}

async function maybeScheduleSla(event: DomainEvent): Promise<void> {
  const { proactive } = await companyContext(event.clientId);
  if (!proactive.enabled || !proactive.config.responseSlaAlertsEnabled) return;
  const at = new Date(event.occurredAt.getTime() + proactive.config.responseSlaMinutes * 60_000);
  await scheduleEvaluation({
    clientId: event.clientId,
    leadId: event.entityId,
    conversationId: event.entityId,
    triggerType: TEMPORAL_TRIGGER_TYPES.CONVERSATION_RESPONSE_SLA,
    triggerEventId: event.id ?? null,
    scheduledAt: at,
    staleAfter: new Date(at.getTime() + 2 * 3600_000),
    payload: {},
    actorOrigin: "CUSTOMER",
    causationId: event.id,
  });
}

async function notifyInventoryManagers(event: DomainEvent): Promise<void> {
  const { getInventorySettings } = await import("@/lib/inventory/service");
  const settings = await getInventorySettings(event.clientId);
  if (!settings.lowStockNotifications) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data: managers } = await supabase
    .from("users")
    .select("id")
    .eq("client_id", event.clientId)
    .eq("role", "CLIENT_MANAGER")
    .eq("is_active", true);
  const kind = event.type === DOMAIN_EVENT_TYPES.INVENTORY_OUT_OF_STOCK ? "out of stock" : "low stock";
  const message = `Inventory ${kind}: product ${String(event.payload.productId ?? event.entityId)}. Available: ${String(event.payload.available ?? "n/a")}.`;
  await Promise.all(
    (managers ?? []).map((m) =>
      supabase.from("notifications").insert({
        user_id: m.id,
        type: "INVENTORY_ALERT",
        message: message.slice(0, 500),
        read: false,
      })
    )
  );
}
