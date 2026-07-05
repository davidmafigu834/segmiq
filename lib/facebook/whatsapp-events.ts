import { createAdminClient } from "@/lib/supabase/admin";
import { fbLog } from "./log";

type WhatsAppStatusItem = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title?: string; message?: string; error_data?: unknown }>;
};

type WhatsAppInbound = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

export type WhatsAppWebhookValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  statuses?: WhatsAppStatusItem[];
  messages?: WhatsAppInbound[];
};

export async function handleWhatsAppEvent(value: WhatsAppWebhookValue | Record<string, unknown>): Promise<void> {
  const v = value as WhatsAppWebhookValue;

  if (v.statuses?.length) {
    for (const status of v.statuses) {
      await updateMessageLogStatus(status);
    }
  }

  if (v.messages?.length) {
    const phoneNumberId = v.metadata?.phone_number_id ?? null;
    for (const msg of v.messages) {
      try {
        const { handleInboundWhatsAppMessage } = await import("@/lib/whatsapp/inbound");
        await handleInboundWhatsAppMessage({ phoneNumberId, message: msg });
      } catch (err) {
        fbLog("fb.whatsapp.inbound_message", {
          from: msg.from,
          messageId: msg.id,
          type: msg.type,
          error: err instanceof Error ? err.message : "handler_failed",
        });
      }
    }
  }
}

function mapStatus(raw: string): "sent" | "delivered" | "read" | "failed" {
  const s = raw.toLowerCase();
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed") return "failed";
  return "sent";
}

async function updateMessageLogStatus(status: WhatsAppStatusItem): Promise<void> {
  const { id: providerId, status: rawStatus, errors } = status;
  const newStatus = mapStatus(String(rawStatus));

  const updatePayload: {
    status: "sent" | "delivered" | "read" | "failed";
    updated_at: string;
    error_code?: string | null;
    error_message?: string | null;
  } = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (String(rawStatus).toLowerCase() === "failed" && errors?.[0]) {
    updatePayload.error_code = String(errors[0].code);
    updatePayload.error_message = errors[0].message || errors[0].title || "failed";
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("message_logs")
    .update(updatePayload)
    .eq("provider_id", providerId)
    .select("id, lead_id, user_id, notification_type")
    .maybeSingle();

  if (error) {
    fbLog("fb.whatsapp.status_update_failed", { providerId, error: error.message });
    return;
  }
  if (!data) {
    fbLog("fb.whatsapp.status_no_matching_log", { providerId, newStatus: rawStatus });
    return;
  }

  fbLog("fb.whatsapp.status_updated", { providerId, status: rawStatus, logId: (data as { id: string }).id });
}
