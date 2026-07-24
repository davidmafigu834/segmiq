import type { FbFormQuestion } from "@/lib/facebook/form-questions";
import { isContactFormQuestion } from "@/lib/facebook/form-questions";

export type FbQualTier = "hot" | "warm" | "cold";

export type FbQualOptionRule = {
  /** Option display value and/or Meta option key as stored in field_data */
  value: string;
  points: number;
  /** When matched, force this tier (cold wins over warm/hot). */
  force_tier?: FbQualTier | null;
};

export type FbQualFieldRule = {
  field_key: string;
  label?: string;
  enabled: boolean;
  options: FbQualOptionRule[];
};

export type FbQualificationRules = {
  thresholds: { hot: number; warm: number };
  rules: FbQualFieldRule[];
};

export type FbQualificationResult = {
  score: number;
  tier: FbQualTier;
  reasons: string[];
  matched: Array<{ field_key: string; label: string; answer: string; points: number; force_tier?: FbQualTier | null }>;
};

export const DEFAULT_FB_QUAL_THRESHOLDS = { hot: 70, warm: 45 } as const;

const TIER_RANK: Record<FbQualTier, number> = { cold: 0, warm: 1, hot: 2 };

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseTier(raw: unknown): FbQualTier | null {
  if (raw === "hot" || raw === "warm" || raw === "cold") return raw;
  return null;
}

export function parseFacebookQualificationRules(raw: unknown): FbQualificationRules {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const th = obj.thresholds && typeof obj.thresholds === "object"
    ? (obj.thresholds as Record<string, unknown>)
    : {};
  const hot = typeof th.hot === "number" ? th.hot : DEFAULT_FB_QUAL_THRESHOLDS.hot;
  const warm = typeof th.warm === "number" ? th.warm : DEFAULT_FB_QUAL_THRESHOLDS.warm;

  const rulesIn = Array.isArray(obj.rules) ? obj.rules : [];
  const rules: FbQualFieldRule[] = [];
  for (const r of rulesIn) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const field_key = typeof row.field_key === "string" ? row.field_key.trim() : "";
    if (!field_key) continue;
    const optionsIn = Array.isArray(row.options) ? row.options : [];
    const options: FbQualOptionRule[] = [];
    for (const o of optionsIn) {
      if (!o || typeof o !== "object") continue;
      const opt = o as Record<string, unknown>;
      const value = typeof opt.value === "string" ? opt.value.trim() : "";
      if (!value) continue;
      const points = typeof opt.points === "number" ? opt.points : Number(opt.points) || 0;
      options.push({
        value,
        points: Number.isFinite(points) ? points : 0,
        force_tier: parseTier(opt.force_tier),
      });
    }
    rules.push({
      field_key,
      label: typeof row.label === "string" ? row.label : undefined,
      enabled: row.enabled !== false,
      options,
    });
  }

  return {
    thresholds: {
      hot: clampScore(hot),
      warm: clampScore(Math.min(warm, hot)),
    },
    rules,
  };
}

/** Build default rules from synced questions (all options ignore / 0 pts). */
export function defaultRulesFromQuestions(questions: FbFormQuestion[]): FbQualificationRules {
  return {
    thresholds: { ...DEFAULT_FB_QUAL_THRESHOLDS },
    rules: questions
      .filter((q) => !isContactFormQuestion(q))
      .map((q) => ({
        field_key: q.key,
        label: q.label,
        enabled: q.options.length > 0,
        options: q.options.map((o) => ({
          value: o.value,
          points: 0,
          force_tier: null,
        })),
      })),
  };
}

/** Merge stored rules with freshly synced questions so new options appear. */
export function mergeRulesWithQuestions(
  existing: FbQualificationRules | null | undefined,
  questions: FbFormQuestion[]
): FbQualificationRules {
  const base = existing ?? defaultRulesFromQuestions(questions);
  const byKey = new Map(base.rules.map((r) => [r.field_key, r]));
  const next: FbQualFieldRule[] = [];

  for (const q of questions) {
    if (isContactFormQuestion(q)) continue;
    const prev = byKey.get(q.key);
    if (!prev) {
      next.push({
        field_key: q.key,
        label: q.label,
        enabled: q.options.length > 0,
        options: q.options.map((o) => ({ value: o.value, points: 0, force_tier: null })),
      });
      continue;
    }
    const prevOpts = new Map(prev.options.map((o) => [norm(o.value), o]));
    const options: FbQualOptionRule[] = [];
    if (q.options.length > 0) {
      for (const o of q.options) {
        const hit = prevOpts.get(norm(o.value)) ?? prevOpts.get(norm(o.key));
        options.push(
          hit
            ? { value: o.value, points: hit.points, force_tier: hit.force_tier ?? null }
            : { value: o.value, points: 0, force_tier: null }
        );
      }
      // Keep custom contains-style values that aren't in Meta options
      for (const o of prev.options) {
        if (!options.some((x) => norm(x.value) === norm(o.value))) {
          options.push(o);
        }
      }
    } else {
      options.push(...prev.options);
    }
    next.push({
      field_key: q.key,
      label: q.label || prev.label,
      enabled: prev.enabled,
      options,
    });
  }

  // Keep rules for fields no longer on the form (still useful for historical keys)
  for (const r of base.rules) {
    if (!next.some((n) => n.field_key === r.field_key)) {
      next.push(r);
    }
  }

  return {
    thresholds: base.thresholds,
    rules: next,
  };
}

function answerString(formData: Record<string, unknown>, fieldKey: string): string | null {
  const direct = formData[fieldKey];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);

  // Meta sometimes uses label-like keys; try case-insensitive key match
  const target = norm(fieldKey);
  for (const [k, v] of Object.entries(formData)) {
    if (k.startsWith("_")) continue;
    if (norm(k) === target && typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function matchOption(answer: string, options: FbQualOptionRule[]): FbQualOptionRule | null {
  const a = norm(answer);
  for (const o of options) {
    if (norm(o.value) === a) return o;
  }
  // Soft contains match for long option labels vs shorter answers (or vice versa)
  for (const o of options) {
    const ov = norm(o.value);
    if (ov.length >= 3 && (a.includes(ov) || ov.includes(a))) return o;
  }
  return null;
}

export function tierFromScore(score: number, thresholds: { hot: number; warm: number }): FbQualTier {
  if (score >= thresholds.hot) return "hot";
  if (score >= thresholds.warm) return "warm";
  return "cold";
}

export function evaluateFacebookQualification(
  formData: Record<string, unknown>,
  rulesInput: FbQualificationRules | unknown
): FbQualificationResult {
  const rules = parseFacebookQualificationRules(rulesInput);
  let score = 0;
  const reasons: string[] = [];
  const matched: FbQualificationResult["matched"] = [];
  let forced: FbQualTier | null = null;

  for (const rule of rules.rules) {
    if (!rule.enabled || rule.options.length === 0) continue;
    const answer = answerString(formData, rule.field_key);
    if (!answer) continue;
    const hit = matchOption(answer, rule.options);
    if (!hit) continue;

    score += hit.points;
    const label = rule.label || rule.field_key;
    matched.push({
      field_key: rule.field_key,
      label,
      answer,
      points: hit.points,
      force_tier: hit.force_tier ?? null,
    });
    if (hit.points !== 0 || hit.force_tier) {
      const pts =
        hit.points > 0 ? `+${hit.points}` : hit.points < 0 ? String(hit.points) : "match";
      reasons.push(`${label}: ${answer} (${pts})`);
    }
    if (hit.force_tier) {
      if (!forced || TIER_RANK[hit.force_tier] < TIER_RANK[forced]) {
        forced = hit.force_tier;
      }
    }
  }

  score = clampScore(score);
  let tier = tierFromScore(score, rules.thresholds);
  if (forced === "cold") {
    tier = "cold";
    score = Math.min(score, Math.max(0, rules.thresholds.warm - 1));
    if (!reasons.some((r) => /low priority|cold/i.test(r))) {
      reasons.unshift("Forced low priority from form answer");
    }
  } else if (forced === "hot") {
    tier = "hot";
    score = Math.max(score, rules.thresholds.hot);
  } else if (forced === "warm" && tier === "cold") {
    tier = "warm";
    score = Math.max(score, rules.thresholds.warm);
  }

  if (reasons.length === 0 && matched.length > 0) {
    reasons.push("Form answers matched qualification rules");
  }

  return { score, tier, reasons: reasons.slice(0, 6), matched };
}

/** Apply qualification metadata onto form_data (internal underscore keys). */
export function applyQualificationToFormData(
  formData: Record<string, unknown>,
  result: FbQualificationResult
): Record<string, unknown> {
  return {
    ...formData,
    _fbQualScore: result.score,
    _fbQualTier: result.tier,
    _fbQualReasons: result.reasons,
  };
}

export function facebookQualScoreFromFormData(
  formData: Record<string, unknown> | null | undefined
): number | null {
  const n = formData?._fbQualScore;
  return typeof n === "number" && n > 0 ? n : null;
}

export function facebookQualTierFromFormData(
  formData: Record<string, unknown> | null | undefined
): FbQualTier | null {
  return parseTier(formData?._fbQualTier);
}

export function facebookQualReasonsFromFormData(
  formData: Record<string, unknown> | null | undefined
): string[] {
  const r = formData?._fbQualReasons;
  if (!Array.isArray(r)) return [];
  return r.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
