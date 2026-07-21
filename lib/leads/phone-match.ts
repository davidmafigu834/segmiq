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
