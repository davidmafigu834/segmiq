export function phoneDigitsOnly(phone: string | null | undefined): string {
  return String(phone ?? "").replace(/\D/g, "");
}

/** Loose match for local vs international formats (e.g. 771234567 vs 263771234567). */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ad = phoneDigitsOnly(a);
  const bd = phoneDigitsOnly(b);
  if (!ad || !bd) return false;
  return ad === bd || ad.endsWith(bd) || bd.endsWith(ad);
}

/**
 * Digit suffixes used to query leads/contacts by phone without scanning arbitrary
 * "recent" rows. Prefer longer suffixes first; callers still confirm with phonesMatch.
 */
export function phoneLookupSuffixes(phoneDigits: string | null | undefined): string[] {
  const d = phoneDigitsOnly(phoneDigits);
  if (d.length < 7) return d ? [d] : [];
  const out: string[] = [];
  const push = (value: string) => {
    if (value.length >= 7 && !out.includes(value)) out.push(value);
  };
  push(d);
  if (d.length > 9) push(d.slice(-9));
  if (d.length > 10) push(d.slice(-10));
  if (d.length > 11) push(d.slice(-11));
  return out;
}

/** PostgREST `or` filter for phone / WhatsApp id columns (exact + ends-with). */
export function phoneOrFilter(
  phoneDigits: string,
  columns: Array<"phone" | "whatsapp_wa_id"> = ["phone"]
): string {
  const digits = phoneDigitsOnly(phoneDigits);
  const suffixes = phoneLookupSuffixes(digits);
  const parts: string[] = [];
  for (const col of columns) {
    if (digits) {
      parts.push(`${col}.eq.${digits}`);
      parts.push(`${col}.eq.+${digits}`);
    }
    for (const suffix of suffixes) {
      // PostgREST: *suffix means ends-with
      parts.push(`${col}.like.*${suffix}`);
    }
  }
  return parts.join(",");
}
