import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventsToChatMessages, isWhatsAppRowVisibleInChat, messageLogsToChatMessages, whatsappRowsToChatMessages } from "@/lib/inbox/messages";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { HUB_QUOTATION_EVENT_TYPES, quotationEventsToChatMessages } from "@/lib/quotations/hub-events";
import { isWhatsAppSessionOpen } from "@/lib/whatsapp/inbound";
import { getCampaignContextForLead } from "@/lib/marketing/campaign-reply";

export const dynamic = "force-dynamic";

const SESSION_MS = 24 * 60 * 60 * 1000;

function isSessionLogAlreadyRepresented(
  preview: string,
  providerId: string | null,
  coveredProviderIds: Set<string>,
  existingBodies: Set<string>
): boolean {
  if (providerId && coveredProviderIds.has(providerId)) return true;
  if (existingBodies.has(preview)) return true;
  for (const body of Array.from(existingBodies)) {
    if (body.startsWith(preview) || preview.startsWith(body)) return true;
  }
  return false;
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const requestedLimit = Number(url.searchParams.get("limit") || 80);
  const pageLimit = Math.min(100, Math.max(20, Number.isFinite(requestedLimit) ? requestedLimit : 80));
  const fetchLimit = pageLimit + 1;

  if (session?.userId) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", session.userId)
      .eq("lead_id", params.leadId)
      .in("type", ["WHATSAPP_MESSAGE", "NEW_LEAD"]);
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("source, form_data, created_at")
    .eq("id", params.leadId)
    .maybeSingle();

  const isWhatsApp = lead?.source === "WHATSAPP_INBOUND";
  let messages: InboxChatMessage[] = [];
  let sessionOpen = false;
  let hasMore = false;

  if (isWhatsApp) {
    const waQuery = supabase
      .from("whatsapp_messages")
      .select("id, direction, body, created_at, message_type, status, media_url, media_mime_type, media_storage_key, provider_id")
      .eq("lead_id", params.leadId);
    const timelineQuery = supabase
      .from("lead_events")
      .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
      .eq("lead_id", params.leadId)
      .in("event_type", [
        "CALL_LOGGED",
        "LEAD_ASSIGNED",
        "LEAD_REASSIGNED",
        "FOLLOW_UP_SET",
        "STATUS_CHANGED",
        "NOTE_ADDED",
        "DOCUMENT_SENT",
        "DEAL_CREATED",
        "SUPPORT_CASE_OPENED",
        "CONVERSATION_TRANSFERRED_TO_SUPPORT",
      ]);
    const messageEventQuery = supabase
      .from("lead_events")
      .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
      .eq("lead_id", params.leadId)
      .in("event_type", ["MESSAGE_SENT", "MESSAGE_RECEIVED"]);
    const sessionLogQuery = supabase
      .from("message_logs")
      .select("id, payload_preview, created_at, provider_id, status")
      .eq("lead_id", params.leadId)
      .eq("channel", "whatsapp")
      .eq("notification_type", "WHATSAPP_SESSION")
      .eq("status", "sent");
    const quoteEventQuery = supabase
      .from("quotation_events")
      .select("id, event_type, event_data, created_at, quotation_id")
      .eq("lead_id", params.leadId)
      .in("event_type", [...HUB_QUOTATION_EVENT_TYPES]);
    const quoteQuery = supabase
      .from("quotations")
      .select("id, quote_number, revision_number, total, currency, deal_id")
      .eq("lead_id", params.leadId);

    const [{ data: waRows }, { data: timelineEvents }, { data: messageEvents }, { data: sessionLogs }, { data: quoteEvents }, { data: quoteRows }] =
      await Promise.all([
      (before ? waQuery.lt("created_at", before) : waQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      (before ? timelineQuery.lt("created_at", before) : timelineQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      (before ? messageEventQuery.lt("created_at", before) : messageEventQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      (before ? sessionLogQuery.lt("created_at", before) : sessionLogQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      (before ? quoteEventQuery.lt("created_at", before) : quoteEventQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      quoteQuery,
    ]);

    hasMore = [waRows, timelineEvents, messageEvents, sessionLogs, quoteEvents].some(
      (rows) => (rows?.length ?? 0) > pageLimit
    );

    const visibleWaProviderIds = new Set(
      (waRows ?? [])
        .filter((r) =>
          isWhatsAppRowVisibleInChat({
            body: r.body as string | null,
            media_url: r.media_url as string | null,
            message_type: r.message_type as string | null,
            media_storage_key: r.media_storage_key as string | null,
          })
        )
        .map((r) => r.provider_id as string | null)
        .filter((id): id is string => Boolean(id))
    );

    const chat = whatsappRowsToChatMessages(
      (waRows ?? []).map((r) => ({
        id: r.id as string,
        direction: r.direction as string,
        body: r.body as string | null,
        created_at: r.created_at as string,
        message_type: r.message_type as string | null,
        status: r.status as string | null,
        media_url: r.media_url as string | null,
        media_mime_type: r.media_mime_type as string | null,
        media_storage_key: r.media_storage_key as string | null,
      }))
    );

    const system = eventsToChatMessages(
      (timelineEvents ?? []).map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        event_data: (e.event_data as Record<string, unknown>) ?? {},
        actor_name: (e.actor_name as string) ?? "Unknown",
        actor_role: (e.actor_role as string) ?? "SYSTEM",
        channel: e.channel as string | null,
        created_at: e.created_at as string,
      }))
    );

    const outboundBodies = new Set(
      (waRows ?? [])
        .filter((r) => r.direction === "outbound")
        .map((r) => (r.body as string | null)?.trim())
        .filter((body): body is string => Boolean(body))
    );

    const legacyMessages = eventsToChatMessages(
      (messageEvents ?? [])
        .filter((e) => {
          const providerId = (e.event_data as Record<string, unknown> | null)?.provider_id;
          if (typeof providerId === "string" && visibleWaProviderIds.has(providerId)) return false;
          return true;
        })
        .map((e) => ({
          id: e.id as string,
          event_type: e.event_type as string,
          event_data: (e.event_data as Record<string, unknown>) ?? {},
          actor_name: (e.actor_name as string) ?? "Unknown",
          actor_role: (e.actor_role as string) ?? "SYSTEM",
          channel: e.channel as string | null,
          created_at: e.created_at as string,
        }))
    );

    const coveredProviderIds = new Set(visibleWaProviderIds);
    for (const e of messageEvents ?? []) {
      const providerId = (e.event_data as Record<string, unknown> | null)?.provider_id;
      if (typeof providerId === "string") coveredProviderIds.add(providerId);
    }

    const existingBodies = new Set(
      [...chat, ...legacyMessages]
        .filter((m) => m.kind === "message" && m.direction === "rep" && m.text.trim())
        .map((m) => m.text.trim())
    );

    const logFallback = messageLogsToChatMessages(
      (sessionLogs ?? []).filter((row) => {
        const providerId = (row.provider_id as string | null) ?? null;
        const preview = (row.payload_preview as string | null)?.trim();
        if (!preview) return false;
        return !isSessionLogAlreadyRepresented(preview, providerId, coveredProviderIds, existingBodies);
      })
    );

    const quoteHub = quotationEventsToChatMessages(
      (quoteEvents ?? []).map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        event_data: (e.event_data as Record<string, unknown>) ?? {},
        created_at: e.created_at as string,
        quotation_id: e.quotation_id as string,
      })),
      {
        quotes: (quoteRows ?? []).map((q) => ({
          id: q.id as string,
          quote_number: (q.quote_number as string | null) ?? null,
          revision_number: Number(q.revision_number) || 1,
          total: Number(q.total) || 0,
          currency: (q.currency as string | null) ?? "USD",
          deal_id: (q.deal_id as string | null) ?? null,
        })),
        role: session?.role,
      }
    );
    const hasCanonicalQuoteSent = quoteHub.some((m) => m.systemTitle === "Quote sent");

    const dedupedSystem = system.filter((m) => {
      if (hasCanonicalQuoteSent && m.systemTitle === "Quote sent") return false;
      if (m.kind !== "system" && m.kind !== "message") return true;
      const text = m.text.trim();
      if (text.startsWith("Sent ") && outboundBodies.has(text.replace(/^Sent /, ""))) return false;
      return !outboundBodies.has(text);
    });

    const merged = [...chat, ...dedupedSystem, ...legacyMessages, ...logFallback, ...quoteHub].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    if (merged.length > pageLimit) hasMore = true;
    messages = merged.slice(-pageLimit);

    sessionOpen = await isWhatsAppSessionOpen(params.leadId);
  } else {
    const eventQuery = supabase
      .from("lead_events")
      .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
      .eq("lead_id", params.leadId)
      .in("event_type", ["DOCUMENT_SENT", "NOTE_ADDED", "CALL_LOGGED", "LEAD_CREATED", "MESSAGE_RECEIVED", "MESSAGE_SENT"]);
    const quoteEventQuery = supabase
      .from("quotation_events")
      .select("id, event_type, event_data, created_at, quotation_id")
      .eq("lead_id", params.leadId)
      .in("event_type", [...HUB_QUOTATION_EVENT_TYPES]);
    const [{ data: events, error }, { data: quoteEvents }, { data: quoteRows }] = await Promise.all([
      (before ? eventQuery.lt("created_at", before) : eventQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      (before ? quoteEventQuery.lt("created_at", before) : quoteEventQuery)
        .order("created_at", { ascending: false })
        .limit(fetchLimit),
      supabase
        .from("quotations")
        .select("id, quote_number, revision_number, total, currency, deal_id")
        .eq("lead_id", params.leadId),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const quoteHub = quotationEventsToChatMessages(
      (quoteEvents ?? []).map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        event_data: (e.event_data as Record<string, unknown>) ?? {},
        created_at: e.created_at as string,
        quotation_id: e.quotation_id as string,
      })),
      {
        quotes: (quoteRows ?? []).map((q) => ({
          id: q.id as string,
          quote_number: (q.quote_number as string | null) ?? null,
          revision_number: Number(q.revision_number) || 1,
          total: Number(q.total) || 0,
          currency: (q.currency as string | null) ?? "USD",
          deal_id: (q.deal_id as string | null) ?? null,
        })),
        role: session?.role,
      }
    );
    const hasCanonicalQuoteSent = quoteHub.some((m) => m.systemTitle === "Quote sent");

    hasMore = (events?.length ?? 0) > pageLimit || (quoteEvents?.length ?? 0) > pageLimit;
    messages = [
      ...eventsToChatMessages(
        (events ?? []).map((e) => ({
          id: e.id as string,
          event_type: e.event_type as string,
          event_data: (e.event_data as Record<string, unknown>) ?? {},
          actor_name: (e.actor_name as string) ?? "Unknown",
          actor_role: (e.actor_role as string) ?? "SYSTEM",
          channel: e.channel as string | null,
          created_at: e.created_at as string,
        }))
      ).filter((m) => !(hasCanonicalQuoteSent && m.systemTitle === "Quote sent")),
      ...quoteHub,
    ]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-pageLimit);

    if (messages.length === 0 && lead?.form_data) {
      const fd = lead.form_data as Record<string, unknown>;
      const first = fd.first_message;
      if (typeof first === "string" && first.trim().length >= 1) {
        messages.push({
          id: `form-${params.leadId}`,
          direction: "customer",
          text: first.trim(),
          createdAt: (lead.created_at as string) ?? new Date().toISOString(),
          kind: "message",
        });
      }
    }

    const lastInbound = [...messages].reverse().find((m) => m.direction === "customer" && m.kind === "message");
    if (lastInbound) {
      sessionOpen = Date.now() - new Date(lastInbound.createdAt).getTime() < SESSION_MS;
    }
  }

  const campaignContext = await getCampaignContextForLead(params.leadId);

  return NextResponse.json({
    messages,
    sessionOpen,
    isWhatsApp,
    campaignContext,
    hasMore,
    nextBefore: messages[0]?.createdAt ?? null,
  });
}
