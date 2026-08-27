/**
 * Detects when the agent promised a human/team follow-up in the customer reply.
 * Those turns must become HUMAN_NEEDED so the bot does not keep chatting.
 */

const HANDOFF_PATTERNS: RegExp[] = [
  /\b(i('ll| will)|let me|i can)\s+(ask|check|confirm|verify|find out|get back)\b[\s\S]{0,40}\b(the\s+)?(sales\s+|technical\s+)?team\b/i,
  /\b(ask|check with|confirm with|verify with)\s+(the\s+)?(sales\s+|technical\s+)?team\b/i,
  /\b(the|our)\s+team\s+will\s+(get back|come back|confirm|advise|check|review|look into)\b/i,
  /\bi('ll| will)\s+(get|have|bring)\s+(the|our|a)\s+(sales\s+|technical\s+)?team\b/i,
  /\bpass\s+(this|it)\s+(on\s+)?to\s+(the\s+)?team\b/i,
  /\bsomeone\s+from\s+(the|our)\s+team\b/i,
  /\b(i('ll| will)|let me)\s+confirm\s+with\s+(the\s+)?(team|salesperson|sales\s+team|office)\b/i,
  /\bthe\s+team\s+will\s+(help|assist|contact|reach out)\b/i,
];

export function replyHandsOffToTeam(text: string | null | undefined): boolean {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length < 12) return false;
  return HANDOFF_PATTERNS.some((re) => re.test(value));
}
