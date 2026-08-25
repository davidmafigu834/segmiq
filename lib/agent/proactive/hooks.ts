/**
 * Fire-and-forget integration points for canonical CRM mutations.
 * Failures never break the originating action.
 */

import { emitDomainEvent } from "./events";
import { DOMAIN_EVENT_TYPES } from "./registry";
import type { ActorType } from "./types";
import { persistDoNotContact } from "./opt-out-persist";

type Base = {
  clientId: string;
  actorType?: ActorType;
  actorId?: string | null;
};

export async function hookQuotationSent(
  opts: Base & {
    quotationId: string;
    leadId: string | null;
    dealId: string | null;
    contactId?: string | null;
    revisionNumber?: number | null;
    validUntil?: string | null;
    quoteNumber?: string | null;
  }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.QUOTATION_SENT,
    entityType: "QUOTATION",
    entityId: opts.quotationId,
    actorType: opts.actorType ?? "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `sent:${opts.quotationId}:rev${opts.revisionNumber ?? 1}`,
    payload: {
      leadId: opts.leadId,
      dealId: opts.dealId,
      contactId: opts.contactId ?? null,
      revisionNumber: opts.revisionNumber ?? 1,
      validUntil: opts.validUntil ?? null,
      quoteNumber: opts.quoteNumber ?? null,
    },
  });
}

export async function hookQuotationTerminal(
  opts: Base & {
    quotationId: string;
    type:
      | typeof DOMAIN_EVENT_TYPES.QUOTATION_ACCEPTED
      | typeof DOMAIN_EVENT_TYPES.QUOTATION_DECLINED
      | typeof DOMAIN_EVENT_TYPES.QUOTATION_EXPIRED
      | typeof DOMAIN_EVENT_TYPES.QUOTATION_SUPERSEDED
      | typeof DOMAIN_EVENT_TYPES.QUOTATION_CHANGE_REQUESTED;
    leadId?: string | null;
  }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: opts.type,
    entityType: "QUOTATION",
    entityId: opts.quotationId,
    actorType: opts.actorType ?? "SYSTEM",
    actorId: opts.actorId,
    idempotencyKey: `${opts.type}:${opts.quotationId}`,
    payload: { leadId: opts.leadId ?? null },
  });
}

export async function hookQuotationViewed(opts: Base & { quotationId: string; firstView: boolean }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.QUOTATION_VIEWED,
    entityType: "QUOTATION",
    entityId: opts.quotationId,
    actorType: "CUSTOMER",
    idempotencyKey: opts.firstView ? `viewed-first:${opts.quotationId}` : `viewed:${opts.quotationId}:${Date.now()}`,
    payload: { firstView: opts.firstView },
  });
}

export async function hookCustomerMessage(opts: Base & { leadId: string; text: string; contactId?: string | null }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CONVERSATION_CUSTOMER_MESSAGE,
    entityType: "CONVERSATION",
    entityId: opts.leadId,
    actorType: "CUSTOMER",
    idempotencyKey: `inbound:${opts.leadId}:${opts.actorId ?? nowKey()}`,
    payload: { textPreview: opts.text.slice(0, 120), contactId: opts.contactId ?? null },
  });
}

export async function hookHumanOutbound(opts: Base & { leadId: string }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_MESSAGE,
    entityType: "CONVERSATION",
    entityId: opts.leadId,
    actorType: "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `human-out:${opts.leadId}:${opts.actorId ?? "user"}:${nowKey()}`,
    payload: {},
  });
}

export async function hookCustomerCommitment(
  opts: Base & {
    leadId: string;
    contactId?: string | null;
    dealId?: string | null;
    quotationId?: string | null;
    dueDate: string;
    note?: string;
  }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CUSTOMER_COMMITMENT,
    entityType: "TASK",
    entityId: opts.leadId,
    actorType: opts.actorType ?? "CUSTOMER",
    idempotencyKey: `commitment:${opts.leadId}:${opts.dueDate}`,
    payload: {
      leadId: opts.leadId,
      contactId: opts.contactId ?? null,
      dealId: opts.dealId ?? null,
      quotationId: opts.quotationId ?? null,
      dueDate: opts.dueDate,
      note: opts.note ?? null,
    },
  });
}

export async function hookFollowUpSet(
  opts: Base & { leadId: string; dueDate: string; source: "HUMAN_CREATED" | "CUSTOMER_COMMITMENT" | "AGENT_CREATED" }
): Promise<void> {
  if (opts.source === "CUSTOMER_COMMITMENT") {
    await hookCustomerCommitment({ ...opts, dueDate: opts.dueDate });
    return;
  }
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.TASK_CREATED,
    entityType: "TASK",
    entityId: opts.leadId,
    actorType: opts.actorType ?? "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `task:${opts.leadId}:${opts.dueDate}:${opts.source}`,
    payload: { leadId: opts.leadId, dueDate: opts.dueDate, source: opts.source },
  });
}

export async function hookAppointmentCreated(
  opts: Base & { appointmentId: string; leadId: string; callbackAt: string; purpose?: string | null; dealId?: string | null }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.APPOINTMENT_CREATED,
    entityType: "APPOINTMENT",
    entityId: opts.appointmentId,
    actorType: opts.actorType ?? "AGENT",
    actorId: opts.actorId,
    idempotencyKey: `appt:${opts.appointmentId}:created`,
    payload: {
      leadId: opts.leadId,
      callbackAt: opts.callbackAt,
      purpose: opts.purpose ?? null,
      dealId: opts.dealId ?? null,
    },
  });
}

export async function hookAppointmentRescheduled(
  opts: Base & { appointmentId: string; leadId: string; callbackAt: string; purpose?: string | null }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.APPOINTMENT_RESCHEDULED,
    entityType: "APPOINTMENT",
    entityId: opts.appointmentId,
    actorType: opts.actorType ?? "AGENT",
    idempotencyKey: `appt:${opts.appointmentId}:reschedule:${opts.callbackAt}`,
    payload: { leadId: opts.leadId, callbackAt: opts.callbackAt, purpose: opts.purpose ?? null },
  });
}

export async function hookDealStageChanged(
  opts: Base & { dealId: string; leadId: string; fromStage: string; toStage: string }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.DEAL_STAGE_CHANGED,
    entityType: "DEAL",
    entityId: opts.dealId,
    actorType: opts.actorType ?? "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `deal-stage:${opts.dealId}:${opts.toStage}:${nowKey()}`,
    payload: { leadId: opts.leadId, fromStage: opts.fromStage, toStage: opts.toStage },
  });
}

export async function hookDealClosed(
  opts: Base & { dealId: string; leadId: string; stage: "WON" | "LOST" }
): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.DEAL_CLOSED,
    entityType: "DEAL",
    entityId: opts.dealId,
    actorType: opts.actorType ?? "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `deal-closed:${opts.dealId}:${opts.stage}`,
    payload: { leadId: opts.leadId, stage: opts.stage },
  });
}

export async function hookDealCreated(opts: Base & { dealId: string; leadId: string; stage: string }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.DEAL_CREATED,
    entityType: "DEAL",
    entityId: opts.dealId,
    actorType: opts.actorType ?? "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `deal-created:${opts.dealId}`,
    payload: { leadId: opts.leadId, stage: opts.stage },
  });
}

export async function hookSupportCaseCreated(opts: Base & { caseId: string; leadId: string }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.SUPPORT_CASE_CREATED,
    entityType: "SUPPORT_CASE",
    entityId: opts.caseId,
    actorType: opts.actorType ?? "AGENT",
    idempotencyKey: `support:${opts.caseId}`,
    payload: { leadId: opts.leadId },
  });
}

export async function hookHumanTakeover(opts: Base & { leadId: string }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CONVERSATION_HUMAN_TAKEOVER,
    entityType: "CONVERSATION",
    entityId: opts.leadId,
    actorType: "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `takeover:${opts.leadId}:${nowKey()}`,
    payload: {},
  });
}

export async function hookAgentResumed(opts: Base & { leadId: string }): Promise<void> {
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CONVERSATION_AGENT_RESUMED,
    entityType: "CONVERSATION",
    entityId: opts.leadId,
    actorType: "HUMAN",
    actorId: opts.actorId,
    idempotencyKey: `resume:${opts.leadId}:${nowKey()}`,
    payload: {},
  });
}

export async function hookCustomerOptOut(opts: Base & { contactId: string; leadId?: string | null; reason: string }): Promise<void> {
  await persistDoNotContact(opts);
  await emitDomainEvent({
    clientId: opts.clientId,
    type: DOMAIN_EVENT_TYPES.CUSTOMER_OPTED_OUT,
    entityType: "CUSTOMER",
    entityId: opts.contactId,
    actorType: "CUSTOMER",
    idempotencyKey: `opt-out:${opts.contactId}`,
    payload: { leadId: opts.leadId ?? null, reason: opts.reason },
  });
}

function nowKey(): string {
  return String(Date.now());
}
