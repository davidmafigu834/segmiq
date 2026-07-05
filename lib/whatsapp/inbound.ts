import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadRow } from "@/types";
import { logLeadCreated, logLeadAssigned, logLeadEvent } from "@/lib/lead-events";
import { newMagicToken } from "@/lib/lead-helpers";
import { notifyNewLead, notifyWhatsAppInboundMessage, notifyAdminsNoSalesperson } from "@/lib/notifications";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { pickAssigneeForInbound } from "./assignment";
import { resolveClientFromWhatsAppPhoneNumberId } from "./resolve-client";

const SESSION_MS = 24 * 60 * 60 * 1000;

type InboundPayload = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { title?: string }; list_reply?: { title?: string } };
};

function extractBody(msg: InboundPayload): string {
  if (msg.type === "text" && msg.text?.body?.trim()) return msg.text.body.trim();
  if (msg.type === "button" && msg.button?.text?.trim()) return msg.button.text.trim();
  if (msg.interactive?.button_reply?.title?.trim()) return msg.interactive.button_reply.title.trim();
  if (msg.interactive?.list_reply?.title?.trim()) return msg.interactive.list_reply.title.trim();
  if (msg.type === "image") return "[Image]";
  if (msg.type === "audio") return "[Voice message]";
  if (msg.type === "video") return "[Video]";
  if (msg.type === "document") return "[Document]";
  if (msg.type === "location") return "[Location]";
  return `[${msg.type || "message"}]`;
}

function displayPhone(from: string, dialCode: string | null): string {
  const digits = from.replace(/\D/g, "");
  const wa = normalizePhoneForWhatsApp(digits, dialCode);
  if (wa) return `+${wa}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function isWhatsAppSessionOpen(leadId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return false;
  return Date.now() - new Date(data.created_at as string).getTime() < SESSION_MS;
}

export async function handleInboundWhatsAppMessage(opts: {
  phoneNumberId?: string | null;
  message: InboundPayload;
}): Promise<void> {
  const { message } = opts;
  const providerId = message.id?.trim();
  if (!providerId) return;

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (existing) return;

  const client = await resolveClientFromWhatsAppPhoneNumberId(opts.phoneNumberId);
  if (!client) return;

  const body = extractBody(message);
  const phone = displayPhone(message.from, client.dial_code);
  const phoneDigits = phone.replace(/\D/g, "");

  let leadId: string | null = null;
  let isNewLead = false;
  let assignedToId: string | null = null;

  const { data: openLeads } = await supabase
    .from("leads")
    .select("id, assigned_to_id, name, phone, status")
    .eq("client_id", client.id)
    .eq("source", "WHATSAPP_INBOUND")
    .or("is_archived.is.null,is_archived.eq.false")
    .not("status", "in", '("WON","LOST","NOT_QUALIFIED")')
    .order("updated_at", { ascending: false })
    .limit(20);

  const matched =
    (openLeads ?? []).find((l) => {
      const lp = String(l.phone ?? "").replace(/\D/g, "");
      return lp === phoneDigits || lp.endsWith(phoneDigits) || phoneDigits.endsWith(lp);
    }) ?? null;

  if (matched) {
    leadId = matched.id as string;
    assignedToId = (matched.assigned_to_id as string | null) ?? null;
  } else {
    isNewLead = true;
    const { assigneeId, salespeople } = await pickAssigneeForInbound({
      supabase,
      clientId: client.id,
      assignmentMode: client.assignment_mode,
    });
    assignedToId = assigneeId;

    let contactId: string | null = null;
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("client_id", client.id)
      .eq("phone", phone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id as string;
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          client_id: client.id,
          name: null,
          phone,
          source: "WHATSAPP_INBOUND",
          lead_origin: "client",
          lifecycle: "lead",
        })
        .select("id")
        .single();
      contactId = (newContact?.id as string) ?? null;
    }

    const { token, expires } = newMagicToken();
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({
        client_id: client.id,
        assigned_to_id: assignedToId,
        source: "WHATSAPP_INBOUND",
        status: "NEW",
        name: (existingContact?.name as string | null) ?? null,
        phone,
        contact_id: contactId,
        form_data: { channel: "whatsapp", first_message: body },
        magic_token: token,
        magic_token_expires_at: expires,
      })
      .select("id, assigned_to_id, name, phone")
      .single();

    if (leadErr || !lead) return;
    leadId = lead.id as string;
    assignedToId = (lead.assigned_to_id as string | null) ?? assignedToId;

    const assignee = assignedToId ? salespeople.find((s) => s.id === assignedToId) : null;
    await logLeadCreated({
      leadId,
      clientId: client.id,
      source: "WHATSAPP_INBOUND",
      assignedToName: assignee?.name,
      formDataSummary: body,
    });

    if (assignee) {
      await logLeadAssigned({
        leadId,
        clientId: client.id,
        actor: { id: null, name: "System", role: "SYSTEM" },
        assignedToId: assignee.id,
        assignedToName: assignee.name,
      });

      const { data: managers } = await supabase
        .from("users")
        .select("id, name, email, phone, notification_prefs")
        .eq("client_id", client.id)
        .eq("role", "CLIENT_MANAGER")
        .eq("is_active", true);

      const { data: clientRow } = await supabase
        .from("clients")
        .select("twilio_whatsapp_override")
        .eq("id", client.id)
        .maybeSingle();

      const { data: leadFull } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (leadFull) {
        await notifyNewLead(
          leadFull as LeadRow,
        {
          id: assignee.id,
          name: assignee.name,
          phone: assignee.phone,
          email: assignee.email,
        },
        (managers ?? []).map((m) => ({
          id: m.id as string,
          name: m.name as string,
          phone: (m.phone as string | null) ?? null,
          email: (m.email as string | null) ?? null,
          notification_prefs: m.notification_prefs,
        })),
        (clientRow?.twilio_whatsapp_override as string | null) ?? null,
        client.name,
        { salesPrefs: parseSalesPrefs(assignee.notification_prefs) }
        );
      }
    } else {
      await notifyAdminsNoSalesperson({
        clientName: client.name,
        leadId,
        clientId: client.id,
      });
    }
  }

  const now = new Date().toISOString();
  await supabase.from("whatsapp_messages").insert({
    client_id: client.id,
    lead_id: leadId,
    direction: "inbound",
    provider_id: providerId,
    phone,
    body,
    message_type: message.type || "text",
    created_at: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : now,
    updated_at: now,
  });

  await logLeadEvent({
    leadId,
    clientId: client.id,
    actor: { id: null, name: "Customer", role: "CUSTOMER" },
    eventType: "MESSAGE_RECEIVED",
    eventData: { body, provider_id: providerId, message_type: message.type },
    channel: "whatsapp",
  });

  await supabase.from("leads").update({ updated_at: now }).eq("id", leadId);

  if (!isNewLead && assignedToId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("name, phone")
      .eq("id", leadId)
      .maybeSingle();
    const { data: rep } = await supabase
      .from("users")
      .select("id, name, notification_prefs")
      .eq("id", assignedToId)
      .maybeSingle();

    if (rep) {
      await notifyWhatsAppInboundMessage({
        userId: assignedToId,
        leadId,
        leadName: (lead?.name as string | null) ?? phone,
        preview: body,
        salesPrefs: parseSalesPrefs(rep.notification_prefs),
      });
    }
  }
}
