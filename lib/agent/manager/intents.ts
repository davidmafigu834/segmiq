export type QuickIntent =
  | "OPERATIONAL_SUMMARY"
  | "QUOTE_APPROVALS"
  | "CUSTOMERS_WAITING"
  | "DEALS_NO_NEXT_ACTION"
  | "TODAY_APPOINTMENTS"
  | "AGENT_ACTIVITY"
  | "PROACTIVE_TODAY"
  | "DAILY_BRIEF"
  | "TEAM_PERFORMANCE"
  | "OVERDUE_TASKS"
  | "HUMAN_NEEDED"
  | "SUPPORT_OPEN"
  | "LEARNING_WEEK"
  | "LEARNING_CONFLICTS"
  | "LEARNING_CORRECTIONS"
  | "LEARNING_FAQS";

const QUICK: Array<{ intent: QuickIntent; re: RegExp }> = [
  { intent: "OPERATIONAL_SUMMARY", re: /what needs (my )?attention|needs attention today|^attention$/i },
  { intent: "DAILY_BRIEF", re: /(today'?s|monday )?sales brief|give me (the |today'?s )?brief|morning brief/i },
  { intent: "QUOTE_APPROVALS", re: /quotation?s? (waiting|pending|need).*(approval)|approval queue|waiting for approval/i },
  { intent: "CUSTOMERS_WAITING", re: /customers? waiting|waiting for (us|salesperson|a reply)|unhandled chats|who is waiting/i },
  { intent: "DEALS_NO_NEXT_ACTION", re: /no next action|deals? (at risk|gone cold|inactive)|stuck deals/i },
  { intent: "TODAY_APPOINTMENTS", re: /appointments? today|site visits? today|what('s| is) on (the )?calendar/i },
  { intent: "AGENT_ACTIVITY", re: /what did (segmiq )?agent handle|agent activity|enquir(?:y|ies) (did )?agent/i },
  { intent: "PROACTIVE_TODAY", re: /proactive|follow-?ups? (scheduled|planned|tomorrow)|what is (segmiq|agent) planning/i },
  { intent: "TEAM_PERFORMANCE", re: /how is the (sales )?team|team perform/i },
  { intent: "OVERDUE_TASKS", re: /overdue (tasks?|follow-?ups?)/i },
  { intent: "HUMAN_NEEDED", re: /human needed|waiting for human|handoffs?/i },
  { intent: "SUPPORT_OPEN", re: /support cases?|unresolved support/i },
  { intent: "LEARNING_WEEK", re: /what (has|did) (the )?(segmiq |agent )?learn|learned (this week|from (the )?sales)|new (learning|qualification) patterns/i },
  { intent: "LEARNING_CONFLICTS", re: /contradict company brain|learning conflicts?|where does the (sales )?team contradict/i },
  { intent: "LEARNING_CORRECTIONS", re: /agent corrections?|copilot corrections?|human corrections?/i },
  { intent: "LEARNING_FAQS", re: /customer questions are increasing|faq (candidates?|learning)|common (customer )?questions/i },
];

export function matchQuickIntent(text: string): QuickIntent | null {
  const t = text.trim();
  if (!t) return null;
  for (const row of QUICK) {
    if (row.re.test(t)) return row.intent;
  }
  return null;
}

const UNSUPPORTED = [
  { re: /\b(weather|joke|poem|recipe)\b/i, message: "Command Center is designed for your SegmiQ sales operation." },
  { re: /\bsql\b|\bselect\b[\s\S]*\bfrom\b|\binsert\s+into\b|\bdrop\s+table\b/i, message: "SQL is not available. Ask about Leads, Deals, quotations, or your team." },
  { re: /\bdelete (this |the )?(customer|deal|quotation|user|lead)\b/i, message: "Deleting records is not available in Command Center. Use the canonical page if you need to archive a Lead." },
  {
    re: /\b(change|set|increase|raise).{0,40}(discount|max discount|pricing policy|margin)\b/i,
    message: "Pricing and discount policy are controlled in Commercial Settings, not Command Center.",
  },
  {
    re: /\b(rewrite|replace|ignore).{0,40}(company brain|credit policy|payment terms)\b/i,
    message: "Company Brain and commercial policy cannot be rewritten from Command Center. Review Learning Center or Company Brain instead.",
  },
  {
    re: /\b(create admin|grant role|change password|elevate permission)\b/i,
    message: "User and permission changes are not available through Command Center.",
  },
  {
    re: /\bunlimited follow-?ups|send (them )?every hour\b/i,
    message: "Proactive follow-up limits are controlled in SegmiQ Agent → Proactive.",
  },
];

export function matchUnsupported(text: string): string | null {
  const t = text.trim();
  for (const row of UNSUPPORTED) {
    if (row.re.test(t)) return row.message;
  }
  return null;
}

export function looksLikeConfirm(text: string): boolean {
  return /^(yes|y|confirm|approved?|do it|go ahead|proceed)\b/i.test(text.trim());
}

export function looksLikeCancel(text: string): boolean {
  return /^(no|cancel|never ?mind|stop|don't)\b/i.test(text.trim());
}
