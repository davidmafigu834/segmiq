export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits;
}

export function buildWhatsAppUrl(digits: string, message: string): string {
  const msg = encodeURIComponent(message);
  return digits
    ? `whatsapp://send?phone=${digits}&text=${msg}`
    : `whatsapp://send?text=${msg}`;
}

export function buildOpenerMessage(opts: {
  leadFirstName: string;
  repName: string;
  companyName?: string;
}): string {
  const repFirst = opts.repName.trim().split(/\s+/)[0] ?? "";
  const company = opts.companyName?.trim() ?? "";
  const intro = repFirst
    ? company
      ? `this is ${repFirst} from ${company}`
      : `this is ${repFirst}`
    : company
      ? `this is the team at ${company}`
      : "this is our team";
  return `Hi ${opts.leadFirstName}, ${intro}. Thanks for reaching out — when would be a good time to chat?`;
}

export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const digits = normalizePhoneForWhatsApp(phone);
  if (!digits) return false;
  const url = buildWhatsAppUrl(digits, message);
  const link = document.createElement("a");
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export function dialPhone(phone: string | null | undefined): boolean {
  const trimmed = phone?.trim();
  if (!trimmed) return false;
  window.location.href = `tel:${trimmed}`;
  return true;
}
