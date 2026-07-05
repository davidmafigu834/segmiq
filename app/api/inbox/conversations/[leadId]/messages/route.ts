import { NextResponse } from "next/server";
import { canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventsToChatMessages, whatsappRowsToChatMessages } from "@/lib/inbox/messages";
import type { InboxChatMessage } from "@/lib/inbox/types";
import { isWhatsAppSessionOpen } from "@/lib/whatsapp/inbound";

export const dynamic = "force-dynamic";

const SESSION_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canReadLead(params.leadId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }

  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("source, form_data, created_at")
    .eq("id", params.leadId)
    .maybeSingle();

  const isWhatsApp = lead?.source === "WHATSAPP_INBOUND";
  let messages: InboxChatMessage[] = [];
  let sessionOpen = false;

  if (isWhatsApp) {
    const [{ data: waRows }, { data: systemEvents }] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("id, direction, body, created_at")
        .eq("lead_id", params.leadId)
        .order("created_at", { ascending: true }),
      supabase
        .from("lead_events")
        .select("id, event_type, event_data, actor_name, actor_role, channel, created_at")
        .eq("lead_id", params.leadId)
        .in("event_type", ["CALL_LOGGED", "LEAD_ASSIGNED", "LEAD_REASSIGNED", "FOLLOW_UP_SET"])
        .order("created_at", { ascending: true }),
    ]);

    const chat = whatsappRowsToChatMessages(
      (waRows ?? []).map((r) => ({
        id: r.id as string,
        direction: r.direction as string,
        body: r.body as string | null,
        created_at: r.created_at as string,
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

    messages = [...chat, ...system].sort(
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
