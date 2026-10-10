const EMPTY_SUMMARY = /no action is waiting on this conversation\.?/gi;
const EARLIER_LABEL = /earlier context:\s*/gi;

/** One readable summary. Drops repeated labels and the empty-state sentence. */
export function readableCopilotSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const pieces = summary
    .replace(EARLIER_LABEL, " ")
    .replace(EMPTY_SUMMARY, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const piece of pieces) {
    const key = piece.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(piece);
  }
  const text = unique.join(" ").trim();
  return text || null;
}

/** Keep one earlier note for a long chat, without nesting the previous summary. */
export function carryCopilotSummary(current: string, previous: string | null | undefined): string {
  const earlier = readableCopilotSummary(previous);
  const now = readableCopilotSummary(current);
  if (!earlier) return current;
  if (!now) return earlier;
  if (now.includes(earlier) || earlier.includes(now)) return now.length >= earlier.length ? now : earlier;
  return `Earlier context: ${earlier} ${now}`.slice(0, 800);
}
