import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

function asCountryCode(iso: string): CountryCode {
  const u = (iso || "US").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(u)) return u as CountryCode;
  return "US";
}

/**
 * Normalize any plausible user input to E.164, using default country when no + prefix.
 * Strips a leading `whatsapp:` scheme before parsing.
 */
export function normalizeToE164(
  rawPhone: string | null | undefined,
  defaultCountry: string = process.env.DEFAULT_COUNTRY_CODE || "ZW"
): string | null {
  if (!rawPhone?.trim()) return null;
  const raw = rawPhone.trim().replace(/^whatsapp:/i, "");
  const cc = asCountryCode(defaultCountry);

  const parsed = parsePhoneNumberFromString(raw, cc);
  if (parsed?.isValid()) return parsed.format("E.164");

  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    const p2 = parsePhoneNumberFromString(digits);
    if (p2?.isValid()) return p2.format("E.164");
  }

  return null;
}

/** E.164-ish: optional +, then 10–15 digits (strict + prefix). */
export function isValidE164ish(phone: string): boolean {
  const n = normalizeToE164(phone, process.env.DEFAULT_COUNTRY_CODE || "US");
  return Boolean(n);
}

/** @deprecated Use normalizeToE164 — kept for call sites that expect this name. */
export function normalizePhoneE164(phone: string): string | null {
  return normalizeToE164(phone, process.env.DEFAULT_COUNTRY_CODE || "US");
}
