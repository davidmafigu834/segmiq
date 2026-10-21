const SIMPLE_GREETING = /^(?:hi+e*|hey+|hello+|good\s+(?:morning|afternoon|evening))(?:\s+there)?[\s!.,?\u{1F300}-\u{1FAFF}]*$/iu;

/**
 * Replies that are safer and faster to handle without an LLM or tools.
 * Keep this deliberately narrow: anything containing a real request must
 * continue through the normal reasoning and catalogue flow.
 */
export function simpleGreetingReply(message: string | null | undefined): string | null {
  const normalized = message?.trim();
  if (!normalized || normalized.length > 40 || !SIMPLE_GREETING.test(normalized)) return null;
  return "Hi! How can we help you today?";
}

const PRICE_INTENT = /\b(?:how\s*much|price|cost|quote|quotation)\b/i;
const TYRE_SIZE = /\b(\d{3})\s*\/\s*(\d{2,3})\s*r\s*(\d{2}(?:\.\d)?)\s*([a-z])?\b/i;

/** Return a normalized catalogue query for an explicit tyre-price request. */
export function tyrePriceQuery(message: string | null | undefined): string | null {
  const normalized = message?.trim();
  if (!normalized || !PRICE_INTENT.test(normalized)) return null;
  const match = TYRE_SIZE.exec(normalized);
  if (!match) return null;
  return `${match[1]}/${match[2]}R${match[3]}${match[4]?.toUpperCase() ?? ""}`;
}
