import { formatLocalDateTime } from "@/lib/agent/dates";

export function appointmentReminderMessage(opts: {
  customerFirstName: string;
  purpose: string | null;
  callbackAtIso: string;
  timezone: string;
  location?: string | null;
}): string {
  const when = formatLocalDateTime(opts.callbackAtIso, opts.timezone);
  const name = opts.customerFirstName || "there";
  const purpose = (opts.purpose ?? "appointment").trim() || "appointment";
  const location = opts.location?.trim();
  const loc = location ? ` ${location.startsWith("at ") ? location : `at ${location}`}` : "";
  return `Hi ${name}, just a reminder that your ${purpose} is scheduled for ${when}${loc}.`;
}

export function missedAppointmentMessage(opts: {
  customerFirstName: string;
  purpose: string | null;
}): string {
  const name = opts.customerFirstName || "there";
  const purpose = (opts.purpose ?? "appointment").trim() || "appointment";
  return `Hi ${name}, we missed you for today's ${purpose}. Would you like me to help arrange another time?`;
}

export function expiredQuoteMessage(opts: {
  customerFirstName: string;
  quoteNumber: string | null;
}): string {
  const name = opts.customerFirstName || "there";
  const q = opts.quoteNumber ? ` ${opts.quoteNumber}` : "";
  return `Hi ${name}, the previous quotation${q} has expired. I can ask the team to prepare an updated version for you.`;
}

export function quoteFollowUpFallback(opts: {
  customerFirstName: string;
  quoteNumber: string | null;
  projectHint: string | null;
  commitment?: boolean;
}): string {
  const name = opts.customerFirstName || "there";
  if (opts.commitment) {
    return `Hi ${name}, you asked us to follow up today. Are you ready to continue?`;
  }
  const quote = opts.quoteNumber ? ` ${opts.quoteNumber}` : "";
  const project = opts.projectHint ? ` for ${opts.projectHint}` : "";
  return `Hi ${name}, just checking whether you had a chance to review the quotation${quote}${project}. Is there anything you'd like us to clarify?`;
}

const URGENCY = /\b(last chance|act now|expires in minutes|final chance|you've ignored)\b/i;

export function sanitizeProactiveMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (URGENCY.test(cleaned)) {
    return cleaned.replace(URGENCY, "").replace(/\s+/g, " ").trim();
  }
  return cleaned.slice(0, 700);
}
