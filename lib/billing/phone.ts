import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";

/**
 * Normalise a manager/user phone for Meta WhatsApp sends, using the client's
 * `dial_code` (263 / 260 / 27 / 254) as the country prefix source — never a
 * hardcoded country. Returns E.164 (+…) or null when invalid.
 */
export function normalizeBillingPhone(
  raw: string | null | undefined,
  clientDialCode: string | null | undefined
): string | null {
  const digits = normalizePhoneForWhatsApp(raw, clientDialCode);
  if (!digits) return null;
  return `+${digits}`;
}
