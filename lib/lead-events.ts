import { createAdminClient } from "@/lib/supabase/admin";

type EventType =
  | "LEAD_CREATED"
  | "LEAD_ASSIGNED"
  | "LEAD_REASSIGNED"
  | "STATUS_CHANGED"
  | "CALL_LOGGED"
  | "NOTE_ADDED"
  | "DOCUMENT_SENT"
  | "FOLLOW_UP_SET";

type Actor = {
  id: string | null;
  name: string;
  role: string;
};

export async function logLeadEvent({
  leadId,
  clientId,
  actor,
  eventType,
  eventData = {},
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  eventType: EventType;
  eventData?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    client_id: clientId,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: eventType,
    event_data: eventData,
  });

  if (error) {
    // Never throw — event logging must never break the main action
    console.error("Failed to log lead event:", error);
  }
}

export async function logLeadCreated({
  leadId,
  clientId,
  source,
  assignedToName,
  formDataSummary,
}: {
  leadId: string;
  clientId: string;
  source: string;
  assignedToName?: string;
  formDataSummary?: string;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor: { id: null, name: "System", role: "SYSTEM" },
    eventType: "LEAD_CREATED",
    eventData: {
      source,
      assigned_to_name: assignedToName ?? null,
      form_data_summary: formDataSummary ?? null,
    },
  });
}

export async function logLeadAssigned({
  leadId,
  clientId,
  actor,
  assignedToId,
  assignedToName,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  assignedToId: string;
  assignedToName: string;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "LEAD_ASSIGNED",
    eventData: {
      assigned_to_id: assignedToId,
      assigned_to_name: assignedToName,
    },
  });
}

export async function logLeadReassigned({
  leadId,
  clientId,
  actor,
  fromId,
  fromName,
  toId,
  toName,
  handoverNotes,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  fromId: string | null;
  fromName: string;
  toId: string | null;
  toName: string;
  handoverNotes?: string | null;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "LEAD_REASSIGNED",
    eventData: {
      from_id: fromId,
      from_name: fromName,
      to_id: toId,
      to_name: toName,
      handover_notes: handoverNotes ?? null,
    },
  });
}

export async function logStatusChanged({
  leadId,
  clientId,
  actor,
  fromStatus,
  toStatus,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  fromStatus: string;
  toStatus: string;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "STATUS_CHANGED",
    eventData: {
      from_status: fromStatus,
      to_status: toStatus,
    },
  });
}

export async function logCallLogged({
  leadId,
  clientId,
  actor,
  outcome,
  notes,
  followUpDate,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  outcome: string;
  notes?: string | null;
  followUpDate?: string | null;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "CALL_LOGGED",
    eventData: {
      outcome,
      notes: notes ?? null,
      follow_up_date: followUpDate ?? null,
    },
  });
}

export async function logDocumentSent({
  leadId,
  clientId,
  actor,
  documentType,
  documentName,
  url,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  documentType: string;
  documentName: string;
  url?: string | null;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "DOCUMENT_SENT",
    eventData: {
      document_type: documentType,
      document_name: documentName,
      url: url ?? null,
    },
  });
}

export async function logFollowUpSet({
  leadId,
  clientId,
  actor,
  followUpDate,
  notes,
}: {
  leadId: string;
  clientId: string;
  actor: Actor;
  followUpDate: string;
  notes?: string | null;
}): Promise<void> {
  await logLeadEvent({
    leadId,
    clientId,
    actor,
    eventType: "FOLLOW_UP_SET",
    eventData: {
      follow_up_date: followUpDate,
      notes: notes ?? null,
    },
  });
}
