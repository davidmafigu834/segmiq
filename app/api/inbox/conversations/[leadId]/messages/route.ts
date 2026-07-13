import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventsToChatMessages, whatsappRowsToChatMessages } from "@/lib/inbox/messages";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { isWhatsAppSessionOpen } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";

const SESSION_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const session = await getServerSession(authOptions);
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

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

  if (isWhatsApp) {
    const [{ data: waRows }, { data: systemEvents }, { data: templateEvents }, { data: messageEvents }] =
      await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("id, direction, body, created_at, message_type, status, media_url, media_mime_type, provider_id")
        .eq("lead_id", params.leadId)
        .order("created_at", { ascending: true }),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
        .eq("lead_id", params.leadId)
        .in("event_type", ["CALL_LOGGED", "LEAD_ASSIGNED", "LEAD_REASSIGNED", "FOLLOW_UP_SET"])
        .order("created_at", { ascending: true }),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
        .eq("lead_id", params.leadId)
        .eq("event_type", "DOCUMENT_SENT")
        .order("created_at", { ascending: true }),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
        .eq("lead_id", params.leadId)
        .in("event_type", ["MESSAGE_SENT", "MESSAGE_RECEIVED"])
        .order("created_at", { ascending: true }),
    ]);

    const waProviderIds = new Set(
      (waRows ?? [])
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
      }))
    );

    const system = eventsToChatMessages(
      (systemEvents ?? []).map((e) => ({
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

    const templateAndEventMessages = eventsToChatMessages(
      [...(templateEvents ?? []), ...(messageEvents ?? [])]
        .filter((e) => {
          if (e.event_type === "MESSAGE_SENT" || e.event_type === "MESSAGE_RECEIVED") {
            const providerId = (e.event_data as Record<string, unknown> | null)?.provider_id;
            if (typeof providerId === "string" && waProviderIds.has(providerId)) return false;
            return true;
          }
          if (e.event_type !== "DOCUMENT_SENT") return true;
          const d = (e.event_data as Record<string, unknown>) ?? {};
          const docType = String(d.document_type ?? "");
          if (docType === "CUSTOM_MESSAGE") {
            const msg = String(d.custom_message ?? "").trim();
            if (msg && outboundBodies.has(msg)) return false;
          }
          const docName = String(d.document_name ?? d.document_type ?? "document");
          const sentLabel = `Sent ${docName}`;
          if (outboundBodies.has(sentLabel)) return false;
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

    messages = [...chat, ...templateAndEventMessages, ...system].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sessionOpen = await isWhatsAppSessionOpen(params.leadId);
  } else {
    const { data: events, error } = await supabase
      .from("lead_events")
      .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
      .eq("lead_id", params.leadId)
      .in("event_type", ["DOCUMENT_SENT", "NOTE_ADDED", "CALL_LOGGED", "LEAD_CREATED", "MESSAGE_RECEIVED", "MESSAGE_SENT"])
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    messages = eventsToChatMessages(
      (events ?? []).map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        event_data: (e.event_data as Record<string, unknown>) ?? {},
        actor_name: (e.actor_name as string) ?? "Unknown",
        actor_role: (e.actor_role as string) ?? "SYSTEM",
        channel: e.channel as string | null,
        created_at: e.created_at as string,
      }))
    );

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

  return NextResponse.json({ messages, sessionOpen, isWhatsApp });
}
