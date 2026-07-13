export function isWhatsAppInboundLead(source?: string | null): boolean {
  return source === "WHATSAPP_INBOUND";
}

export function whatsappFirstMessage(
  formData?: Record<string, unknown> | null
): string | null {
  if (!formData) return null;
  const first = formData.first_message;
  if (typeof first === "string" && first.trim()) return first.trim();
  return null;
}

export function whatsappLeadDisplayName(lead: {
  name?: string | null;
  phone?: string | null;
}): string {
  const name = lead.name?.trim();
  if (name) return name;
  const phone = lead.phone?.trim();
  if (phone) return phone;
  return "WhatsApp contact";
}

export function whatsappLeadSecondaryLine(lead: {
  name?: string | null;
  phone?: string | null;
  form_data?: Record<string, unknown> | null;
}): string {
  const preview = whatsappFirstMessage(lead.form_data);
  if (preview) {
    return preview.length > 96 ? `${preview.slice(0, 93)}…` : preview;
  }
  if (lead.name?.trim() && lead.phone?.trim()) return lead.phone.trim();
  return "WhatsApp conversation";
}

export function whatsappInboxHref(leadId: string): string {
  return `/sales/inbox?lead=${leadId}`;
}

export function leadCardDisplayName(lead: {
  name?: string | null;
  phone?: string | null;
  source?: string | null;
}): string {
  if (isWhatsAppInboundLead(lead.source)) return whatsappLeadDisplayName(lead);
  return lead.name?.trim() || "Unknown";
}
