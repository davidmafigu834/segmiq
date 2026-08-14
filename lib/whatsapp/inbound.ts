import { createAdminClient } from "@/lib/supabase/admin";
import type { LeadRow } from "@/types";
import { logLeadCreated, logLeadAssigned, logLeadEvent } from "@/lib/lead-events";
import { newMagicToken } from "@/lib/lead-helpers";
import { notifyNewLead, notifyWhatsAppInboundMessage, notifyAdminsNoSalesperson } from "@/lib/notifications";
import { parseSalesPrefs } from "@/lib/notification-prefs";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import { findOpenLeadByPhone } from "@/lib/leads/findOpenLeadByPhone";
import { pickAssigneeForInbound } from "./assignment";
import { fetchWhatsAppMediaAsset } from "./media";
import { processWhatsAppQualification } from "./qualification";
import { resolveClientFromWhatsAppPhoneNumberId } from "./resolve-client";
import {
  findRecentCampaignRecipient,
  handleCampaignReply,
} from "@/lib/marketing/campaign-reply";
import { isOptOutMessage, recordWhatsAppOptOut } from "@/lib/marketing/consent";

const SESSION_MS = 24 * 60 * 60 * 1000;

type MediaPayload = {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
};

type InboundPayload = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  interactive?: { type?: string; button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: MediaPayload;
  audio?: MediaPayload;
  video?: MediaPayload;
  document?: MediaPayload;
  sticker?: MediaPayload;
};

export type WhatsAppContactProfile = {
  waId: string;
  name: string | null;
};

function extractBody(msg: InboundPayload, caption?: string | null): string {
  if (caption?.trim()) return caption.trim();
  if (msg.type === "text" && msg.text?.body?.trim()) return msg.text.body.trim();
  if (msg.type === "button" && msg.button?.text?.trim()) return msg.button.text.trim();
  if (msg.interactive?.button_reply?.title?.trim()) return msg.interactive.button_reply.title.trim();
  if (msg.interactive?.list_reply?.title?.trim()) return msg.interactive.list_reply.title.trim();
  if (msg.type === "image") return caption?.trim() ? caption.trim() : "Photo";
  if (msg.type === "audio") return caption?.trim() ? caption.trim() : "Voice message";
  if (msg.type === "video") return caption?.trim() ? caption.trim() : "Video";
  if (msg.type === "document") return msg.document?.filename?.trim() || "";
  if (msg.type === "sticker") return "";
  if (msg.type === "location") return "Location";
  return "";
}

function mediaPayloadForType(msg: InboundPayload): MediaPayload | undefined {
  if (msg.type === "image") return msg.image;
  if (msg.type === "audio") return msg.audio;
  if (msg.type === "video") return msg.video;
  if (msg.type === "document") return msg.document;
  if (msg.type === "sticker") return msg.sticker;
  return undefined;
}

async function syncWhatsAppIdentity(opts: {
  supabase: ReturnType<typeof createAdminClient>;
  contactId: string | null;
  leadId: string;
  phone: string;
  profile?: WhatsAppContactProfile | null;
}) {
  const { supabase, contactId, leadId, phone, profile } = opts;
  const profileName = profile?.name?.trim() || null;
  const waId = profile?.waId?.trim() || phone.replace(/\D/g, "");
  const now = new Date().toISOString();

  if (contactId) {
    const contactUpdate: Record<string, unknown> = { updated_at: now, whatsapp_wa_id: waId };
    if (profileName) {
      contactUpdate.whatsapp_profile_name = profileName;
      contactUpdate.name = profileName;
    }
    await supabase.from("contacts").update(contactUpdate).eq("id", contactId);
  }

  const leadUpdate: Record<string, unknown> = { updated_at: now };
  if (profileName) leadUpdate.name = profileName;
  await supabase.from("leads").update(leadUpdate).eq("id", leadId);
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

  if (data?.created_at) {
    return Date.now() - new Date(data.created_at as string).getTime() < SESSION_MS;
  }

  const { data: event } = await supabase
    .from("lead_events")
    .select("created_at")
    .eq("lead_id", leadId)
    .eq("event_type", "MESSAGE_RECEIVED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (event?.created_at) {
    return Date.now() - new Date(event.created_at as string).getTime() < SESSION_MS;
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("source, created_at, form_data")
    .eq("id", leadId)
    .maybeSingle();

  if (lead?.source === "WHATSAPP_INBOUND") {
    const fd = lead.form_data as Record<string, unknown> | null;
    const hasWhatsAppOrigin =
      fd?.channel === "whatsapp" ||
      (typeof fd?.first_message === "string" && fd.first_message.trim().length > 0);
    if (hasWhatsAppOrigin) {
      return Date.now() - new Date(lead.created_at as string).getTime() < SESSION_MS;
    }
  }

  return false;
}

export async function handleInboundWhatsAppMessage(opts: {
  phoneNumberId?: string | null;
  message: InboundPayload;
  contactProfile?: WhatsAppContactProfile | null;
}): Promise<void> {
  const { message, contactProfile } = opts;
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

  const mediaRef = mediaPayloadForType(message);
  const mediaAsset = await fetchWhatsAppMediaAsset(client.id, mediaRef);
  const body = extractBody(message, mediaAsset.caption);
  const phone = displayPhone(message.from, client.dial_code);
  const phoneDigits = phone.replace(/\D/g, "");

  let leadId: string | null = null;
  let contactId: string | null = null;
  let isNewLead = false;
  let assignedToId: string | null = null;

  const campaignMatch = await findRecentCampaignRecipient({
    clientId: client.id,
    phoneDigits,
  });

  if (campaignMatch?.leadId) {
    leadId = campaignMatch.leadId;
    contactId = campaignMatch.contactId;
    const { data: campLead } = await supabase
      .from("leads")
      .select("assigned_to_id, contact_id")
      .eq("id", leadId)
      .maybeSingle();
    assignedToId = (campLead?.assigned_to_id as string | null) ?? null;
    if (!contactId) contactId = (campLead?.contact_id as string | null) ?? null;
  }

  if (!leadId) {
    const matched = await findOpenLeadByPhone({
      supabase,
      clientId: client.id,
      phoneDigits,
    });

    if (matched) {
      leadId = matched.id as string;
      assignedToId = (matched.assigned_to_id as string | null) ?? null;
      contactId = (matched.contact_id as string | null) ?? null;
    }
  }

  if (!leadId) {
    isNewLead = true;
    const { assigneeId, salespeople } = await pickAssigneeForInbound({
      supabase,
      clientId: client.id,
      assignmentMode: client.assignment_mode,
      phoneDigits,
    });
    assignedToId = assigneeId;

    const profileName = contactProfile?.name?.trim() || null;
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
          name: profileName,
          phone,
          source: "WHATSAPP_INBOUND",
          lead_origin: "client",
          lifecycle: "cold",
          whatsapp_profile_name: profileName,
          whatsapp_wa_id: contactProfile?.waId ?? phoneDigits,
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
        name: profileName ?? (existingContact?.name as string | null) ?? null,
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

  await syncWhatsAppIdentity({
    supabase,
    contactId,
    leadId,
    phone,
    profile: contactProfile ?? { waId: message.from, name: null },
  });

  const now = new Date().toISOString();
  await supabase.from("whatsapp_messages").insert({
    client_id: client.id,
    lead_id: leadId,
    direction: "inbound",
    provider_id: providerId,
    phone,
    body,
    message_type: message.type || "text",
    media_url: mediaAsset.url,
    media_mime_type: mediaAsset.mimeType,
    media_caption: mediaAsset.caption,
    media_storage_key: mediaAsset.storageKey,
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

  const reopenResult = await supabase
    .from("leads")
    .update({
      updated_at: now,
      whatsapp_conversation_status: "OPEN",
      whatsapp_resolved_at: null,
      whatsapp_resolved_by_id: null,
    })
    .eq("id", leadId);
  if (reopenResult.error) {
    // Compatibility while the conversation-state migration is rolling out.
    await supabase.from("leads").update({ updated_at: now }).eq("id", leadId);
  }

  if (contactId && isOptOutMessage(body)) {
    await recordWhatsAppOptOut({
      contactId,
      clientId: client.id,
      reason: body.trim(),
    });
  }

  if (leadId && body.trim()) {
    try {
      await handleCampaignReply({
        clientId: client.id,
        phoneDigits,
        body,
        leadId,
        contactId,
      });
    } catch (err) {
      console.error("[whatsapp] campaign reply handling error:", err);
    }
  }

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

  try {
    await processWhatsAppQualification({
      clientId: client.id,
      clientName: client.name,
      leadId,
      phone,
      inboundBody: body,
      isNewLead,
    });
  } catch (err) {
    console.error("[whatsapp] qualification error:", err);
  }
}
