export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeLabel(value)
    .split(" ")
    .filter((t) => t.length >= 2);
}

export function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = tokenize(b);
  if (!left.size || !right.length) return 0;
  let hits = 0;
  for (const token of right) if (left.has(token)) hits += 1;
  return hits / Math.max(left.size, right.length);
}

/** Block customer/person-specific category names. */
export function isPersonSpecificCategoryName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/\b(mr|mrs|ms|dr)\s+[a-z]/i.test(n)) return true;
  if (/\b(customer|client)\s+[a-z]{3,}/i.test(n) && !/\bcontracts?\b/i.test(n)) return true;
  if (/\b(august|september|january|february|march|april|may|june|july|october|november|december)\s+\d{4}\b/i.test(n)) {
    return true;
  }
  if (n.split(/\s+/).length > 6) return true;
  return false;
}

export function isReusableCategoryName(name: string): boolean {
  const normalized = normalizeLabel(name);
  if (!normalized || normalized.length < 3) return false;
  if (isPersonSpecificCategoryName(name)) return false;
  return true;
}

export function rankCategoryMatches(
  proposedName: string,
  categories: Array<{ id: string; name: string; description?: string | null }>
): Array<{ id: string; name: string; score: number }> {
  return categories
    .map((category) => {
      const base = overlapScore(proposedName, category.name);
      const withDescription = category.description
        ? Math.max(base, overlapScore(proposedName, `${category.name} ${category.description}`) * 0.95)
        : base;
      return { id: category.id, name: category.name, score: withDescription };
    })
    .filter((row) => row.score > 0.35)
    .sort((a, b) => b.score - a.score);
}

export const CATEGORY_SYNONYM_GROUPS: string[][] = [
  ["client contracts", "client agreements", "customer contracts", "client contract"],
  ["environmental compliance", "environmental regulatory", "environmental and regulatory", "licences and compliance"],
  ["supplier agreements", "supplier contracts", "vendor agreements"],
  ["company policies", "policies", "hr policies"],
];

export function synonymBoost(proposed: string, existing: string): number {
  const p = normalizeLabel(proposed);
  const e = normalizeLabel(existing);
  for (const group of CATEGORY_SYNONYM_GROUPS) {
    const pHit = group.some((g) => p.includes(g) || g.includes(p));
    const eHit = group.some((g) => e.includes(g) || g.includes(e));
    if (pHit && eHit) return 0.9;
  }
  return 0;
}
