import { createAdminClient } from "@/lib/supabase/admin";
import { createLead } from "@/lib/leads/createLead";
import { logFollowUpSet, logLeadEvent } from "@/lib/lead-events";
import { createDealFromLead } from "@/lib/sales/deals/create-deal";
import type { LeadSource } from "@/types";
import { logSocialAudit } from "./audit";
import { notifySocialInbox } from "./notifications";
import { sendSocialMessage } from "./providers";
import { getConversationRow } from "./store";
import type { SocialInboxActor } from "./types";

function asOpp(row: unknown): Record<string, unknown> | null {
  if (!row) return null;
  if (Array.isArray(row)) return (row[0] as Record<string, unknown>) ?? null;
  return row as Record<string, unknown>;
}

function asIdentity(row: unknown): Record<string, unknown> | null {
  if (!row) return null;
  if (Array.isArray(row)) return (row[0] as Record<string, unknown>) ?? null;
  return row as Record<string, unknown>;
}

export async function markConversationRead(clientId: string, conversationId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("social_conversations")
    .update({ unread: false, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("id", conversationId);
}

export async function replyToConversation(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  body: string;
  visibility: "public" | "private";
  idempotencyKey?: string | null;
  aiDraft?: boolean;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string; status: number }> {
  const text = opts.body.trim();
  if (!text) return { ok: false, error: "Message cannot be empty.", status: 400 };
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  if (row.is_demo) {
    return { ok: false, error: "Sample conversations cannot send to Meta.", status: 400 };
  }

  const supabase = createAdminClient();
  if (opts.idempotencyKey) {
    const { data: existing } = await supabase
      .from("social_messages")
      .select("id")
      .eq("client_id", opts.actor.clientId)
      .eq("client_idempotency_key", opts.idempotencyKey)
      .maybeSingle();
    if (existing?.id) return { ok: true, messageId: existing.id as string };
  }

  const { data: pending, error: insertErr } = await supabase
    .from("social_messages")
    .insert({
      client_id: opts.actor.clientId,
      conversation_id: opts.conversationId,
      identity_id: row.identity_id,
      client_idempotency_key: opts.idempotencyKey ?? null,
      direction: "outbound",
      visibility: opts.visibility,
      body: text,
      actor_id: opts.actor.userId,
      send_status: "sending",
      ai_draft: Boolean(opts.aiDraft),
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !pending) {
    if (insertErr?.message?.includes("duplicate") && opts.idempotencyKey) {
      const { data: again } = await supabase
        .from("social_messages")
        .select("id")
        .eq("client_id", opts.actor.clientId)
        .eq("client_idempotency_key", opts.idempotencyKey)
        .maybeSingle();
      if (again?.id) return { ok: true, messageId: again.id as string };
    }
    return { ok: false, error: "Could not queue the message.", status: 500 };
  }

  const identity = asIdentity(row.identity);
  const sent = await sendSocialMessage({
    clientId: opts.actor.clientId,
    connectionId: (row as { connection_id?: string | null }).connection_id ?? null,
    channel: row.channel,
    providerThreadId: (row as { provider_thread_id?: string | null }).provider_thread_id ?? null,
    recipientId: String(identity?.provider_user_id ?? ""),
    body: text,
    visibility: opts.visibility,
  });

  const now = new Date().toISOString();
  if (!sent.ok) {
    await supabase
      .from("social_messages")
      .update({ send_status: "failed", send_error: sent.error })
      .eq("id", pending.id)
      .eq("client_id", opts.actor.clientId);
    return { ok: false, error: sent.error, status: sent.code === "not_connected" ? 409 : 502 };
  }

  await supabase
    .from("social_messages")
    .update({
      send_status: "sent",
      provider_message_id: sent.providerMessageId,
      send_error: null,
    })
    .eq("id", pending.id)
    .eq("client_id", opts.actor.clientId);

  await supabase
    .from("social_conversations")
    .update({
      unread: false,
      last_message_at: now,
      last_business_message_at: now,
      last_message_preview: text.slice(0, 180),
      status: "waiting_for_customer",
      updated_at: now,
    })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);

  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: opts.aiDraft ? "ai_reply_sent" : "reply_sent",
    conversationId: opts.conversationId,
    metadata: { visibility: opts.visibility, channel: row.channel },
  });

  return { ok: true, messageId: pending.id as string };
}

export async function addInternalNote(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const text = opts.body.trim();
  if (!text) return { ok: false, error: "Note cannot be empty.", status: 400 };
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const supabase = createAdminClient();
  await supabase.from("social_messages").insert({
    client_id: opts.actor.clientId,
    conversation_id: opts.conversationId,
    identity_id: row.identity_id,
    direction: "outbound",
    visibility: "private",
    body: text,
    is_internal_note: true,
    actor_id: opts.actor.userId,
    send_status: "sent",
    sent_at: new Date().toISOString(),
  });
  return { ok: true };
}

export async function assignConversation(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  assigneeId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const supabase = createAdminClient();
  if (opts.assigneeId) {
    const { data: user } = await supabase
      .from("users")
      .select("id, name, client_id, is_active")
      .eq("id", opts.assigneeId)
      .maybeSingle();
    if (!user || user.client_id !== opts.actor.clientId || user.is_active === false) {
      return { ok: false, error: "That teammate is not in this company.", status: 400 };
    }
  }
  const now = new Date().toISOString();
  await supabase
    .from("social_conversations")
    .update({ assigned_to_id: opts.assigneeId, updated_at: now })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);
  const opp = asOpp(row.opportunity);
  if (opp?.id) {
    await supabase
      .from("social_opportunities")
      .update({ assigned_to_id: opts.assigneeId, updated_at: now })
      .eq("id", opp.id)
      .eq("client_id", opts.actor.clientId);
  }
  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: row.assigned_to_id ? "conversation_reassigned" : "opportunity_assigned",
    conversationId: opts.conversationId,
    opportunityId: (opp?.id as string | undefined) ?? null,
    metadata: { assigneeId: opts.assigneeId },
  });
  if (opts.assigneeId && opts.assigneeId !== opts.actor.userId) {
    const identity = asIdentity(row.identity);
    await notifySocialInbox({
      userId: opts.assigneeId,
      clientId: opts.actor.clientId,
      message: `Social opportunity assigned: ${identity?.display_name ?? "a customer"}`,
      conversationId: opts.conversationId,
    });
  }
  return { ok: true };
}

export async function resolveConversation(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  resolved: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const supabase = createAdminClient();
  await supabase
    .from("social_conversations")
    .update({
      status: opts.resolved ? "resolved" : "open",
      unread: opts.resolved ? false : row.unread,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);
  if (opts.resolved) {
    await logSocialAudit({
      clientId: opts.actor.clientId,
      actorId: opts.actor.userId,
      actorName: opts.actor.name,
      eventType: "conversation_resolved",
      conversationId: opts.conversationId,
    });
  }
  return { ok: true };
}

export async function convertOpportunityToLead(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  forceNew?: boolean;
}): Promise<
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; error: string; status: number; match?: { leadId: string; name: string } }
> {
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const identity = asIdentity(row.identity);
  const opp = asOpp(row.opportunity);
  if (row.linked_lead_id) {
    return { ok: true, leadId: row.linked_lead_id, duplicate: true };
  }

  const source: LeadSource = row.provider === "instagram" ? "INSTAGRAM" : "FACEBOOK";
  const summary = [
    `Channel: ${row.channel.replace(/_/g, " ")}`,
    identity?.username ? `Username: ${identity.username}` : null,
    opp?.detected_product ? `Product: ${opp.detected_product}` : null,
    Array.isArray(opp?.intent_reasons) ? `Intent: ${(opp.intent_reasons as string[]).join(", ")}` : null,
    row.origin_campaign_name ? `Campaign: ${row.origin_campaign_name}` : null,
    row.last_message_preview ? `Latest: ${row.last_message_preview}` : null,
    opts.notes,
  ]
    .filter(Boolean)
    .join("\n");

  const created = await createLead({
    clientId: opts.actor.clientId,
    source,
    formData: {
      name: opts.name || identity?.display_name || "Social visitor",
      phone: opts.phone || "",
      email: opts.email || "",
      project_type: (opp?.detected_product as string | undefined) || "",
      _socialConversationId: opts.conversationId,
      _socialOpportunityId: opp?.id ?? null,
      _conversationSummary: summary,
      _channel: row.channel,
      _campaign: row.origin_campaign_name,
    },
    overrideAssigneeId: row.assigned_to_id ?? opts.actor.userId,
    skipNotifications: false,
  });

  if (!created.ok) {
    return { ok: false, error: created.error || "Could not create the lead.", status: 400 };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("social_conversations")
    .update({
      linked_lead_id: created.leadId,
      assigned_to_id: row.assigned_to_id ?? opts.actor.userId,
      updated_at: now,
    })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);
  if (opp?.id) {
    await supabase
      .from("social_opportunities")
      .update({
        status: "converted",
        lead_id: created.leadId,
        updated_at: now,
      })
      .eq("id", opp.id)
      .eq("client_id", opts.actor.clientId);
  }

  await logLeadEvent({
    leadId: created.leadId,
    clientId: opts.actor.clientId,
    actor: { id: opts.actor.userId, name: opts.actor.name ?? "Sales", role: opts.actor.role },
    eventType: "NOTE_ADDED",
    eventData: {
      source: "social_inbox",
      conversationId: opts.conversationId,
      summary,
    },
    channel: "social",
  });

  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: "lead_converted",
    conversationId: opts.conversationId,
    opportunityId: (opp?.id as string | undefined) ?? null,
    metadata: { leadId: created.leadId, duplicate: Boolean(created.duplicate) },
  });

  return { ok: true, leadId: created.leadId, duplicate: Boolean(created.duplicate) };
}

export async function createDealFromSocial(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  name?: string;
}): Promise<{ ok: true; dealId: string; leadId: string } | { ok: false; error: string; status: number }> {
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  let leadId = row.linked_lead_id;
  if (!leadId) {
    const converted = await convertOpportunityToLead({
      actor: opts.actor,
      conversationId: opts.conversationId,
      name: opts.name,
    });
    if (!converted.ok) return converted;
    leadId = converted.leadId;
  }
  const identity = asIdentity(row.identity);
  const opp = asOpp(row.opportunity);
  const created = await createDealFromLead({
    leadId,
    actorId: opts.actor.userId,
    name: opts.name || (identity?.display_name as string) || "Social opportunity",
    serviceSummary: (opp?.detected_product as string | undefined) ?? null,
    notes: row.last_message_preview,
    force: true,
  });
  if (!created.ok) return { ok: false, error: created.error, status: created.status };
  const supabase = createAdminClient();
  await supabase
    .from("social_conversations")
    .update({ linked_deal_id: created.deal.id, updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);
  if (opp?.id) {
    await supabase
      .from("social_opportunities")
      .update({ deal_id: created.deal.id, updated_at: new Date().toISOString() })
      .eq("id", opp.id)
      .eq("client_id", opts.actor.clientId);
  }
  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: "deal_created",
    conversationId: opts.conversationId,
    metadata: { dealId: created.deal.id, leadId },
  });
  return { ok: true, dealId: created.deal.id, leadId };
}

export async function createSocialFollowUp(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  followUpAt: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const when = Date.parse(opts.followUpAt);
  if (!Number.isFinite(when)) return { ok: false, error: "Choose a valid follow-up date.", status: 400 };
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const supabase = createAdminClient();
  const iso = new Date(when).toISOString();
  const dateOnly = iso.slice(0, 10);
  const opp = asOpp(row.opportunity);
  if (opp?.id) {
    await supabase
      .from("social_opportunities")
      .update({
        follow_up_at: iso,
        follow_up_reason: opts.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opp.id)
      .eq("client_id", opts.actor.clientId);
  }
  await supabase
    .from("social_conversations")
    .update({ status: "follow_up_required", updated_at: new Date().toISOString() })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);

  if (row.linked_lead_id) {
    await supabase
      .from("leads")
      .update({ follow_up_date: dateOnly, follow_up_source: "HUMAN_CREATED" })
      .eq("id", row.linked_lead_id)
      .eq("client_id", opts.actor.clientId);
    await logFollowUpSet({
      leadId: row.linked_lead_id,
      clientId: opts.actor.clientId,
      actor: { id: opts.actor.userId, name: opts.actor.name ?? "Sales", role: opts.actor.role },
      followUpDate: dateOnly,
      notes: opts.reason ?? "Social Inbox",
    });
  }

  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: "follow_up_created",
    conversationId: opts.conversationId,
    metadata: { followUpAt: iso, reason: opts.reason ?? null },
  });
  return { ok: true };
}

export async function linkSocialIdentity(opts: {
  actor: SocialInboxActor;
  conversationId: string;
  contactId?: string | null;
  leadId?: string | null;
  rejected?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await getConversationRow(opts.actor.clientId, opts.conversationId);
  if (!row) return { ok: false, error: "Conversation not found.", status: 404 };
  const identity = asIdentity(row.identity);
  if (!identity?.id) return { ok: false, error: "Missing social identity.", status: 400 };
  const supabase = createAdminClient();
  if (opts.rejected) {
    await supabase
      .from("social_identities")
      .update({ match_status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", identity.id)
      .eq("client_id", opts.actor.clientId);
    await logSocialAudit({
      clientId: opts.actor.clientId,
      actorId: opts.actor.userId,
      actorName: opts.actor.name,
      eventType: "identity_unlinked",
      identityId: identity.id as string,
      conversationId: opts.conversationId,
    });
    return { ok: true };
  }
  await supabase.from("social_identity_links").insert({
    client_id: opts.actor.clientId,
    identity_id: identity.id,
    contact_id: opts.contactId ?? null,
    lead_id: opts.leadId ?? null,
    match_kind: "manual",
    confidence: 80,
    linked_by_user_id: opts.actor.userId,
  });
  await supabase
    .from("social_identities")
    .update({ match_status: "linked", updated_at: new Date().toISOString() })
    .eq("id", identity.id)
    .eq("client_id", opts.actor.clientId);
  await supabase
    .from("social_conversations")
    .update({
      linked_contact_id: opts.contactId ?? null,
      linked_lead_id: opts.leadId ?? row.linked_lead_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.conversationId)
    .eq("client_id", opts.actor.clientId);
  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: "identity_linked",
    identityId: identity.id as string,
    conversationId: opts.conversationId,
    metadata: { contactId: opts.contactId ?? null, leadId: opts.leadId ?? null },
  });
  return { ok: true };
}

export async function bulkAssign(opts: {
  actor: SocialInboxActor;
  conversationIds: string[];
  assigneeId: string | null;
}): Promise<{ ok: true; count: number } | { ok: false; error: string; status: number }> {
  const ids = opts.conversationIds.slice(0, 50);
  if (!ids.length) return { ok: false, error: "Nothing selected.", status: 400 };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("social_conversations")
    .select("id")
    .eq("client_id", opts.actor.clientId)
    .in("id", ids);
  const owned = (data ?? []).map((r) => r.id as string);
  await supabase
    .from("social_conversations")
    .update({ assigned_to_id: opts.assigneeId, updated_at: new Date().toISOString() })
    .eq("client_id", opts.actor.clientId)
    .in("id", owned);
  await logSocialAudit({
    clientId: opts.actor.clientId,
    actorId: opts.actor.userId,
    actorName: opts.actor.name,
    eventType: "bulk_assign",
    metadata: { count: owned.length, assigneeId: opts.assigneeId },
  });
  return { ok: true, count: owned.length };
}
