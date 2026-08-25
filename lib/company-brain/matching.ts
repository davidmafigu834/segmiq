import { CORE_BUNDLES, INTENT_BUNDLE_HINTS } from "./constants";
import type {
  BrainFaq,
  ContextBundle,
  EscalationRule,
  KnowledgeChunk,
  PlaybookField,
  QualificationPlaybook,
  ServiceArea,
} from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((t) => t.length >= 2);
}

function overlapScore(query: string, candidate: string): number {
  const q = new Set(tokens(query));
  const c = tokens(candidate);
  if (!q.size || !c.length) return 0;
  let hits = 0;
  for (const t of c) if (q.has(t)) hits += 1;
  return hits / Math.max(q.size, 1);
}

export function selectContextBundles(customerMessage: string): {
  bundles: ContextBundle[];
  topics: string[];
} {
  const topics: string[] = [];
  const bundles = new Set<ContextBundle>(CORE_BUNDLES);
  for (const hint of INTENT_BUNDLE_HINTS) {
    if (hint.pattern.test(customerMessage)) {
      topics.push(hint.topic);
      for (const b of hint.bundles) bundles.add(b);
    }
  }
  if (topics.includes("pricing") || topics.includes("product")) {
    bundles.add("SALES");
  }
  if (!topics.length) {
    bundles.add("SALES");
    bundles.add("QUALIFICATION");
  }
  if (topics.includes("service_area")) {
    bundles.add("SALES");
  }
  return { bundles: [...bundles], topics };
}

export function scoreFaqMatch(query: string, faq: Pick<BrainFaq, "question" | "aliases" | "approvedAnswer">): number {
  const q = normalize(query);
  if (!q) return 0;
  const aliases = [faq.question, ...(faq.aliases ?? [])];
  let best = 0;
  for (const alias of aliases) {
    const n = normalize(alias);
    if (!n) continue;
    if (q === n) return 1;
    if (q.includes(n) || n.includes(q)) best = Math.max(best, 0.92);
    best = Math.max(best, overlapScore(q, n) * 0.85);
  }
  best = Math.max(best, overlapScore(q, faq.approvedAnswer) * 0.35);
  return Math.min(1, best);
}

export function rankFaqs(query: string, faqs: BrainFaq[], limit = 3): Array<{ faq: BrainFaq; score: number }> {
  return faqs
    .filter((f) => f.active)
    .map((faq) => ({ faq, score: scoreFaqMatch(query, faq) }))
    .filter((row) => row.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreChunk(query: string, content: string): number {
  return overlapScore(query, content);
}

export function rankChunks(
  query: string,
  chunks: KnowledgeChunk[],
  limit = 4
): KnowledgeChunk[] {
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk.content) }))
    .filter((row) => row.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.chunk);
}

function areaHaystack(area: ServiceArea): string {
  return [area.label, area.city, area.region, area.province, area.country, area.serviceCategory]
    .filter(Boolean)
    .join(" ");
}

export function matchServiceArea(
  query: string,
  areas: ServiceArea[]
): { area: ServiceArea; confidence: number } | null {
  const active = areas.filter((a) => a.active);
  if (!active.length) return null;
  const q = normalize(query);
  let best: { area: ServiceArea; confidence: number } | null = null;
  for (const area of active) {
    const hay = normalize(areaHaystack(area));
    if (!hay) continue;
    const parts = [area.city, area.region, area.province, area.label, area.country].filter(Boolean) as string[];
    let confidence = 0;
    for (const part of parts) {
      const n = normalize(part);
      if (!n) continue;
      if (q.includes(n) || n.split(" ").every((t) => q.includes(t))) {
        confidence = Math.max(confidence, n.length >= 4 ? 0.95 : 0.8);
      }
    }
    confidence = Math.max(confidence, overlapScore(q, hay));
    if (!best || confidence > best.confidence) best = { area, confidence };
  }
  if (!best || best.confidence < 0.45) return null;
  return best;
}

export function matchPlaybooks(
  query: string,
  playbooks: QualificationPlaybook[],
  opts?: { productInterest?: string | null; conversationType?: string | null }
): { matched: QualificationPlaybook | null; ambiguous: boolean; candidates: QualificationPlaybook[] } {
  const enabled = playbooks.filter((p) => p.enabled);
  if (!enabled.length) return { matched: null, ambiguous: false, candidates: [] };

  const scored = enabled.map((playbook) => {
    const keywords = playbook.trigger.keywords ?? [];
    const nameBlob = `${playbook.name} ${playbook.description ?? ""} ${playbook.appliesTo ?? ""} ${keywords.join(" ")}`;
    let score = overlapScore(query, nameBlob);
    for (const kw of keywords) {
      const n = normalize(kw);
      if (n && normalize(query).includes(n)) score = Math.max(score, 0.9);
    }
    if (opts?.productInterest) {
      score = Math.max(score, overlapScore(opts.productInterest, nameBlob) * 0.8);
    }
    if (
      playbook.trigger.conversationType &&
      opts?.conversationType &&
      playbook.trigger.conversationType.toUpperCase() === opts.conversationType.toUpperCase()
    ) {
      score += 0.08;
    }
    return { playbook, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  if (!top || top.score < 0.28) {
    if (enabled.length === 1) return { matched: enabled[0], ambiguous: false, candidates: enabled };
    return { matched: null, ambiguous: enabled.length > 1, candidates: enabled };
  }
  if (second && top.score - second.score < 0.12 && second.score >= 0.28) {
    return {
      matched: null,
      ambiguous: true,
      candidates: scored.filter((s) => s.score >= 0.28).slice(0, 3).map((s) => s.playbook),
    };
  }
  return { matched: top.playbook, ambiguous: false, candidates: [top.playbook] };
}

export function visiblePlaybookFields(
  fields: PlaybookField[],
  answers: Record<string, string | null | undefined>
): PlaybookField[] {
  return [...fields]
    .sort((a, b) => a.priority - b.priority)
    .filter((field) => {
      const cond = field.conditional;
      if (!cond) return true;
      const actual = (answers[cond.field] ?? "").toString().trim();
      switch (cond.op) {
        case "equals":
          return normalize(actual) === normalize(cond.value ?? "");
        case "not_equals":
          return normalize(actual) !== normalize(cond.value ?? "");
        case "truthy":
          return Boolean(actual) && !["no", "false", "0"].includes(normalize(actual));
        case "falsy":
          return !actual || ["no", "false", "0"].includes(normalize(actual));
        default:
          return true;
      }
    });
}

export function playbookCompletion(
  playbook: QualificationPlaybook,
  answers: Record<string, string | null | undefined>
): { complete: boolean; missing: string[] } {
  const visible = visiblePlaybookFields(playbook.fields, answers);
  const required = visible.filter((f) => f.required);
  const missing = required.filter((f) => !String(answers[f.internalKey] ?? "").trim()).map((f) => f.internalKey);
  const requireAll = playbook.completion.requireAllRequired !== false;
  if (requireAll) return { complete: missing.length === 0, missing };
  const min = playbook.completion.minRequiredCount ?? required.length;
  const filled = required.length - missing.length;
  return { complete: filled >= min, missing };
}

export function matchEscalationRules(
  intents: string[],
  message: string,
  rules: EscalationRule[],
  extras?: { quotationTotal?: number | null; discountPercent?: number | null }
): EscalationRule[] {
  const q = normalize(message);
  const intentSet = new Set(intents.map((i) => i.toUpperCase()));
  return rules.filter((rule) => {
    if (!rule.enabled) return false;
    const key = rule.conditionKey.toUpperCase();
    if (key === "COMPLAINT" && (intentSet.has("COMPLAINT") || /\b(complaint|angry|terrible|worst|sue)\b/.test(q))) {
      return true;
    }
    if (key === "PRICING_DISPUTE" && (intentSet.has("PRICING_DISPUTE") || /\b(overcharg|rip.?off|too expensive|price is (wrong|high))\b/.test(q))) {
      return true;
    }
    if (key === "DISCOUNT_REQUEST" && (intentSet.has("DISCOUNT_REQUEST") || /\b(discount|reduce the price|knock off|cheaper)\b/.test(q))) {
      const min = Number(rule.conditionConfig.minPercent ?? 0);
      if (min > 0 && extras?.discountPercent != null) return extras.discountPercent >= min;
      return true;
    }
    if (key === "REFUND_REQUEST" && /\b(refund|money back)\b/.test(q)) return true;
    if (key === "TECHNICAL_SAFETY" && /\b(shock|fire|spark|burning|danger|unsafe|gas leak)\b/.test(q)) return true;
    if (key === "LEGAL_THREAT" && /\b(lawyer|attorney|sue|legal action|court)\b/.test(q)) return true;
    if (key === "CONTRACT_CHANGE" && /\b(contract|terms of (the )?deal|change the agreement)\b/.test(q)) return true;
    if (key === "CUSTOMER_REQUESTED_HUMAN" && (intentSet.has("HUMAN_REQUEST") || /\b(human|person|agent|manager|someone (real|from the team))\b/.test(q))) {
      return true;
    }
    if (key === "QUOTATION_ABOVE") {
      const cap = Number(rule.conditionConfig.amount ?? 0);
      return cap > 0 && extras?.quotationTotal != null && extras.quotationTotal > cap;
    }
    if (key === "UNSUPPORTED_REQUEST") return intentSet.has("UNSUPPORTED_REQUEST");
    if (key === "POLICY_BLOCKED") return intentSet.has("POLICY_BLOCKED");
    return false;
  });
}

export function looksLikePromptInjection(text: string): boolean {
  return /\b(ignore (all |previous |your )?instructions|reveal (internal|customer|system)|act as (admin|developer)|jailbreak|system prompt)\b/i.test(
    text
  );
}

export function extractYearMentions(text: string): number[] {
  const matches = text.matchAll(/(\d{1,2})\s*[-–]?\s*(?:year|yr)s?/gi);
  const years: number[] = [];
  for (const m of matches) {
    const n = Number(m[1]);
    if (n > 0 && n <= 50) years.push(n);
  }
  return years;
}

export function detectWarrantyConflict(opts: {
  canonicalWarranty: string | null;
  documentText: string;
}): { canonical: string; document: string } | null {
  if (!opts.canonicalWarranty?.trim()) return null;
  const canonicalYears = extractYearMentions(opts.canonicalWarranty);
  const documentYears = extractYearMentions(opts.documentText);
  if (!canonicalYears.length || !documentYears.length) return null;
  if (canonicalYears.some((y) => documentYears.includes(y))) return null;
  return {
    canonical: opts.canonicalWarranty.trim(),
    document: `${documentYears[0]} year${documentYears[0] === 1 ? "" : "s"}`,
  };
}
