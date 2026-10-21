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
