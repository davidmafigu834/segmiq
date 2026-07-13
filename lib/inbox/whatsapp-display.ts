import { format } from "date-fns";

export function isWhatsAppChatLead(source: string | null | undefined): boolean {
  return source === "WHATSAPP_INBOUND";
}

export function formatChatPhone(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

export function displayChatContactName(conversation: {
  name?: string | null;
  whatsappProfileName?: string | null;
  phone?: string | null;
  source?: string | null;
}): string {
  const profile = conversation.whatsappProfileName?.trim();
  const name = conversation.name?.trim();
  if (profile) return profile;
  if (name) return name;
  const phone = formatChatPhone(conversation.phone);
  if (phone) return phone;
  return isWhatsAppChatLead(conversation.source) ? "WhatsApp contact" : "Unknown";
}

export function chatContactSubtitle(conversation: {
  name?: string | null;
  whatsappProfileName?: string | null;
  phone?: string | null;
}): string | null {
  const display = displayChatContactName(conversation);
  const phone = formatChatPhone(conversation.phone);
  if (phone && display !== phone) return phone;
  return null;
}

export function formatChatSince(createdAt: string): string {
  try {
    return format(new Date(createdAt), "MMM d, yyyy");
  } catch {
    return "";
  }
}
