import type { CountryCode } from "libphonenumber-js";
import { normalizeToE164 } from "@/lib/phone-validate";

/**
 * Resolve the WhatsApp recipient. Legacy `twilio_whatsapp_override` was a test redirect
 * number — only use it when it normalizes to valid E.164; otherwise fall back to the
 * user's real phone so bad override values do not block delivery.
 */
export function resolveWhatsAppRecipient(
  primary: string | null | undefined,
  legacyTestOverride: string | null | undefined,
  defaultCountry: string = process.env.DEFAULT_COUNTRY_CODE || "ZW"
): string | null {
  const cc = defaultCountry.toUpperCase() as CountryCode;
  const override = legacyTestOverride?.trim();
  if (override && normalizeToE164(override, cc)) {
    return override;
  }
  const primaryTrim = primary?.trim();
  return primaryTrim || null;
}
