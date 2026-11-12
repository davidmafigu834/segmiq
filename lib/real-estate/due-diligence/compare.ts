const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "hon"]);

/** Order-independent tokens. Titles and single letters are dropped. */
export function nameTokens(value: string | null | undefined): string[] {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TITLES.has(token));
}

export type NameMatch = "match" | "mismatch" | "insufficient";

/**
 * Zimbabwe ID cards and deeds often reverse surname and forenames.
 * A match needs the same name tokens, or the shorter name contained in the longer one
 * with at least two shared tokens (so a lone surname is not enough).
 */
export function compareNames(left: string | null | undefined, right: string | null | undefined): NameMatch {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (a.length === 0 || b.length === 0) return "insufficient";
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = [...setA].filter((token) => setB.has(token));
  if (overlap.length === setA.size && overlap.length === setB.size) return "match";
  const smaller = Math.min(setA.size, setB.size);
  if (overlap.length >= 2 && overlap.length === smaller) return "match";
  if (overlap.length >= 2 && overlap.length / Math.max(setA.size, setB.size) >= 0.67) return "match";
  return "mismatch";
}

export function normaliseId(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Smile ID's Zimbabwe format: 8–9 digits, a letter, then 2 digits. */
export function isZimbabweNationalId(value: string | null | undefined): boolean {
  return /^[0-9]{8,9}[A-Z][0-9]{2}$/.test(normaliseId(value));
}

export function normaliseStand(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\b(stand|lot|plot|number|no)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalisePlace(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function compareIds(left: string | null | undefined, right: string | null | undefined): NameMatch {
  const a = normaliseId(left);
  const b = normaliseId(right);
  if (a.length < 5 || b.length < 5) return "insufficient";
  return a === b ? "match" : "mismatch";
}

export function compareStands(left: string | null | undefined, right: string | null | undefined): NameMatch {
  const a = normaliseStand(left);
  const b = normaliseStand(right);
  if (a.length === 0 || b.length === 0) return "insufficient";
  return a === b ? "match" : "mismatch";
}

export function comparePlaces(left: string | null | undefined, right: string | null | undefined): NameMatch {
  const a = normalisePlace(left);
  const b = normalisePlace(right);
  if (a.length < 3 || b.length < 3) return "insufficient";
  if (a === b || a.includes(b) || b.includes(a)) return "match";
  return "mismatch";
}
