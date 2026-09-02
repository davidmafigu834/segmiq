/**
 * Deterministic commitment extraction from chat text.
 * Schedules future *evaluations* via upsertCommitment → proactive hook — never blind sends.
 */

import { upsertCommitment } from "./commitments";

export type ExtractedCommitment = {
  committedBy: "CUSTOMER" | "SALESPERSON";
  commitmentType: string;
  description: string;
  dueAt: string | null;
  dueRule: string | null;
  excerpt: string;
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  d.setHours(10, 0, 0, 0);
  return d;
}

function resolveRelativeDue(text: string, now: Date): { dueAt: string | null; dueRule: string | null } {
  const lower = text.toLowerCase();

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return { dueAt: d.toISOString(), dueRule: "tomorrow" };
  }
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    d.setHours(10, 0, 0, 0);
    return { dueAt: d.toISOString(), dueRule: "next_week" };
  }
  if (/\bin\s+(\d+)\s+days?\b/.test(lower)) {
    const n = Number(lower.match(/\bin\s+(\d+)\s+days?\b/)?.[1] ?? 0);
    if (n > 0 && n <= 90) {
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      d.setHours(10, 0, 0, 0);
      return { dueAt: d.toISOString(), dueRule: `in_${n}_days` };
    }
  }
  for (const [name, day] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b(on\\s+)?${name}\\b`).test(lower)) {
      return {
        dueAt: nextWeekday(now, day).toISOString(),
        dueRule: name,
      };
    }
  }
  if (/\btoday\b/.test(lower) && /\b(call|follow|contact|check|send)\b/.test(lower)) {
    const d = new Date(now);
    d.setHours(Math.max(d.getHours() + 2, 16), 0, 0, 0);
    return { dueAt: d.toISOString(), dueRule: "today" };
  }
  return { dueAt: null, dueRule: null };
}

/** Customer: "call me Friday", "follow up next week", "I'll send dimensions tomorrow" */
const CUSTOMER_PATTERNS: Array<{ re: RegExp; type: string; desc: (m: RegExpMatchArray) => string }> = [
  {
    re: /\b(call|contact|check with|follow\s*up with)\s+me\b(.{0,40})/i,
    type: "FOLLOW_UP",
    desc: (m) => `Customer asked to be contacted${m[2]?.trim() ? ` ${m[2].trim()}` : ""}`.slice(0, 200),
  },
  {
    re: /\b(you can|please)\s+(check|follow\s*up|call|contact)\b(.{0,40})/i,
    type: "FOLLOW_UP",
    desc: (m) => `Customer asked for follow-up${m[3]?.trim() ? ` ${m[3].trim()}` : ""}`.slice(0, 200),
  },
  {
    re: /\bi('ll| will)\s+(send|share|provide)\b(.{0,60})/i,
    type: "CUSTOMER_WILL_SEND",
    desc: (m) => `Customer will send${m[3]?.trim() ? ` ${m[3].trim()}` : " information"}`.slice(0, 200),
  },
  {
    re: /\blet me (speak|talk|discuss|check)\b(.{0,80})/i,
    type: "INTERNAL_DISCUSSION",
    desc: (m) => `Customer needs to discuss internally${m[2]?.trim() ? ` — ${m[2].trim()}` : ""}`.slice(0, 200),
  },
];

/** Salesperson: "I'll send the revised quote tomorrow", "I'll call you Friday" */
const SALESPERSON_PATTERNS: Array<{ re: RegExp; type: string; desc: (m: RegExpMatchArray) => string }> = [
  {
    re: /\bi('ll| will)\s+(send|share|prepare|get)\b(.{0,80})/i,
    type: "SALESPERSON_WILL_SEND",
    desc: (m) => `You committed to ${m[2]}${m[3] ?? ""}`.slice(0, 200),
  },
  {
    re: /\bi('ll| will)\s+(call|contact|follow\s*up|check)\b(.{0,60})/i,
    type: "FOLLOW_UP",
    desc: (m) => `You committed to ${m[2]}${m[3] ?? ""}`.slice(0, 200),
  },
  {
    re: /\bi('ll| will)\s+confirm\b(.{0,60})/i,
    type: "CONFIRM_INTERNALLY",
    desc: (m) => `You committed to confirm${m[2] ?? ""}`.slice(0, 200),
  },
];

export function extractCommitmentsFromText(opts: {
  body: string;
  direction: "inbound" | "outbound" | string;
  now?: Date;
}): ExtractedCommitment[] {
  const text = opts.body?.trim();
  if (!text || text.length < 8) return [];
  const now = opts.now ?? new Date();
  const out: ExtractedCommitment[] = [];

  const patterns =
    opts.direction === "inbound" ? CUSTOMER_PATTERNS : opts.direction === "outbound" ? SALESPERSON_PATTERNS : [];

  for (const p of patterns) {
    const m = text.match(p.re);
    if (!m) continue;
    const { dueAt, dueRule } = resolveRelativeDue(text, now);
    out.push({
      committedBy: opts.direction === "inbound" ? "CUSTOMER" : "SALESPERSON",
      commitmentType: p.type,
      description: p.desc(m).replace(/\s+/g, " ").trim(),
      dueAt,
      dueRule,
      excerpt: text.slice(0, 280),
    });
    break; // one primary commitment per message
  }
  return out;
}

export async function extractAndPersistCommitmentsFromMessages(opts: {
  clientId: string;
  leadId: string;
  dealId?: string | null;
  salespersonId?: string | null;
  messages: Array<{
    id?: string | null;
    direction: string;
    body: string | null;
    created_at: string;
  }>;
  /** Only consider recent messages */
  lookbackHours?: number;
}): Promise<number> {
  const lookback = opts.lookbackHours ?? 72;
  const cutoff = Date.now() - lookback * 3600_000;
  let saved = 0;

  for (const msg of opts.messages) {
    if (!msg.body) continue;
    if (Date.parse(msg.created_at) < cutoff) continue;
    const extracted = extractCommitmentsFromText({
      body: msg.body,
      direction: msg.direction,
      now: new Date(msg.created_at),
    });
    for (const c of extracted) {
      // Require a due date for syncable follow-ups; still store open-ended descriptions
      const row = await upsertCommitment({
        clientId: opts.clientId,
        leadId: opts.leadId,
        dealId: opts.dealId,
        salespersonId: opts.salespersonId,
        conversationId: opts.leadId,
        committedBy: c.committedBy,
        commitmentType: c.commitmentType,
        description: c.description,
        dueAt: c.dueAt,
        sourceMessageId: msg.id ?? null,
        sourceMessageExcerpt: c.excerpt,
        syncLeadFollowUp: Boolean(c.dueAt && c.committedBy === "CUSTOMER"),
      });
      if (row) saved += 1;
    }
  }
  return saved;
}
