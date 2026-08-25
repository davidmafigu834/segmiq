/**
 * Deterministic opt-out detection for proactive (and inbound) outreach.
 * The model must never override this.
 */

const EXACT = new Set([
  "stop",
  "stop all",
  "unsubscribe",
  "opt out",
  "opt-out",
  "optout",
  "cancel",
  "remove me",
]);

const PHRASES = [
  /\bstop messaging me\b/i,
  /\bdon't (?:message|contact|text) me(?: again)?\b/i,
  /\bdo not (?:message|contact|text) me(?: again)?\b/i,
  /\bdon't contact me again\b/i,
  /\bremove me\b/i,
  /\bunsubscribe\b/i,
  /\bno more (?:messages|whatsapps?)\b/i,
];

export function isProactiveOptOutMessage(body: string): boolean {
  const normalized = body.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (EXACT.has(normalized)) return true;
  if (normalized.startsWith("stop ")) return true;
  return PHRASES.some((re) => re.test(normalized));
}

/** "after payday" / "when I get paid" are not resolvable dates. */
export function isAmbiguousCommitment(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\bafter payday\b/.test(t)) return true;
  if (/\bwhen I (?:get|have) (?:paid|money|the money)\b/i.test(text)) return true;
  if (/\bafter I get paid\b/.test(t)) return true;
  if (/\bnext payday\b/.test(t)) return true;
  return false;
}
