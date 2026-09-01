import { createAdminClient } from "@/lib/supabase/admin";
import { hasDocumentPermission } from "@/lib/documents/permissions";
import { getDocumentForActor } from "@/lib/documents/service";
import type { DocumentActor } from "@/lib/documents/types";
import { loadDocumentEntityLinks } from "@/lib/documents/linking";

function defaultFollowUpDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function resolveLeadIdForDocument(
  clientId: string,
  documentId: string
): Promise<string | null> {
  const links = await loadDocumentEntityLinks(clientId, documentId);
  const leadLink = links.find((l) => l.entity_type === "LEAD" && l.confirmed);
  if (leadLink) return leadLink.entity_id;

  const dealLink = links.find((l) => l.entity_type === "DEAL" && l.confirmed);
  if (dealLink) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("deals")
      .select("originating_lead_id")
      .eq("id", dealLink.entity_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (data?.originating_lead_id) return data.originating_lead_id as string;
  }

  const customerLink = links.find((l) => l.entity_type === "CUSTOMER" && l.confirmed);
  if (customerLink) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", clientId)
      .eq("contact_id", customerLink.entity_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

export async function createTaskFromObligation(opts: {
  clientId: string;
  documentId: string;
  obligationId: string;
  actor: DocumentActor;
  followUpDate?: string;
}): Promise<
  | { ok: true; leadId: string; followUpDate: string; tasksHref: string }
  | { ok: false; error: string; status: number }
> {
  if (
    !hasDocumentPermission(opts.actor, "documents.obligations.view") &&
    !hasDocumentPermission(opts.actor, "documents.edit")
  ) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  const doc = await getDocumentForActor({
    clientId: opts.clientId,
    documentId: opts.documentId,
    actor: opts.actor,
    recordView: false,
  });
  if (!doc.ok) return { ok: false, error: doc.error, status: doc.status };

  const supabase = createAdminClient();
  const { data: obligation } = await supabase
    .from("document_obligations")
    .select("*")
    .eq("id", opts.obligationId)
    .eq("document_id", opts.documentId)
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (!obligation) {
    return { ok: false, error: "Obligation not found.", status: 404 };
  }

  if (obligation.linked_task_id) {
    return {
      ok: true,
      leadId: obligation.linked_task_id as string,
      followUpDate:
        (obligation.due_date as string | null) ?? defaultFollowUpDate(),
      tasksHref: `/sales/tasks?leadId=${obligation.linked_task_id}`,
    };
  }

  const leadId = await resolveLeadIdForDocument(opts.clientId, opts.documentId);
  if (!leadId) {
    return {
      ok: false,
      error:
        "Link this document to a customer, lead, or deal before creating a follow-up task.",
      status: 422,
    };
  }

  const followUpDate =
    opts.followUpDate ??
    (obligation.due_date as string | null) ??
    defaultFollowUpDate();

  const { error: leadError } = await supabase
    .from("leads")
    .update({ follow_up_date: followUpDate, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (leadError) {
    return { ok: false, error: leadError.message, status: 500 };
  }

  await supabase
    .from("document_obligations")
    .update({
      linked_task_id: leadId,
      status: "IN_PROGRESS",
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.obligationId);

  await supabase.from("document_activity").insert({
    client_id: opts.clientId,
    document_id: opts.documentId,
    version_id: obligation.version_id,
    actor_user_id: opts.actor.userId,
    action: "OBLIGATION_TASK_CREATED",
    metadata: {
      obligationId: opts.obligationId,
      leadId,
      followUpDate,
      action: obligation.action,
    },
  });

  return {
    ok: true,
    leadId,
    followUpDate,
    tasksHref: `/sales/tasks?leadId=${leadId}`,
  };
}
