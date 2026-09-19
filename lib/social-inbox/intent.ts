/**
 * Social intent classification.
 *
 * Production path: rules produce an explainable baseline; an AI classifier
 * may refine it. Rules are never the sole long-term intelligence system,
 * but they are the required fallback so inbound events stay actionable
 * when the model is unavailable.
 *
 * Do not invent facts. Reasons must quote evidence from the message.
 */

import {
  SOCIAL_INTENT_SIGNALS,
  type IntentClassification,
  type SocialIntentBand,
  type SocialIntentSignal,
  type SocialIntentSignalType,
} from "./types";
import { SCORE_HOT_MIN, SCORE_WARM_MIN } from "@/lib/inbox/scoring";

export type ClassifyInput = {
  text: string;
  conversationKind?: "dm" | "comment";
  priorSignals?: SocialIntentSignalType[];
};

const SIGNAL_PATTERNS: Array<{
  type: SocialIntentSignalType;
  weight: number;
  reason: string;
  patterns: RegExp[];
}> = [
  {
    type: "PRICING_INTENT",
    weight: 28,
    reason: "Asked about price",
    patterns: [
      /\b(how much|price|pricing|cost|quote|quotation|deposit|payment plan)\b/i,
      /\b(zwl|usd|\$|rtgs)\b/i,
    ],
  },
  {
    type: "FINANCING_INTENT",
    weight: 22,
    reason: "Asked about financing or deposit",
    patterns: [/\b(deposit|finance|financing|payment plan|instal+ment|credit|loan|funds)\b/i],
  },
  {
    type: "AVAILABILITY_INTENT",
    weight: 20,
    reason: "Asked if it is still available",
    patterns: [/\b(still available|in stock|do you have|available|got (this|one)|any left)\b/i],
  },
  {
    type: "QUOTATION_REQUEST",
    weight: 30,
    reason: "Requested a quotation",
    patterns: [/\b(send( me)? (a |the )?quot|can you quote|need a quote|quotation for)\b/i],
  },
  {
    type: "PURCHASE_INTENT",
    weight: 26,
    reason: "Signalled intent to buy",
    patterns: [/\b(i('d| would)? (like to )?buy|want to (buy|take|order)|ready to (buy|proceed)|we('ll| will) take)\b/i],
  },
  {
    type: "LOCATION_QUERY",
    weight: 16,
    reason: "Asked about location or service area",
    patterns: [
      /\b(deliver|install|cover|operate|based) (in|to|around)\b/i,
      /\b(harare|bulawayo|ruwa|chitungwiza|gweru|mutare|lusaka|johannesburg|nairobi)\b/i,
    ],
  },
  {
    type: "DELIVERY_QUERY",
    weight: 16,
    reason: "Asked about delivery",
    patterns: [/\b(deliver(y|ed)?|transport|ship(ping)?|to site)\b/i],
  },
  {
    type: "INSTALLATION_QUERY",
    weight: 16,
    reason: "Asked about installation",
    patterns: [/\b(install(ation)?|fit(ting)?|set ?up|commission)\b/i],
  },
  {
    type: "PRODUCT_INTEREST",
    weight: 14,
    reason: "Named a product or package",
    patterns: [
      /\b(excavator|solar|kva|inverter|roof|generator|borehole|tractor|grader|loader|package|system)\b/i,
      /\bcat\s?\d{2,4}\b/i,
    ],
  },
  {
    type: "SPECIFICATION_QUERY",
    weight: 12,
    reason: "Asked for specifications",
    patterns: [/\b(spec(s|ification)?|capacity|hours|warranty|size|model|year)\b/i],
  },
  {
    type: "CALLBACK_REQUEST",
    weight: 18,
    reason: "Asked to be called back",
    patterns: [/\b(call me|please call|phone me|whatsapp me|contact me)\b/i],
  },
  {
    type: "FOLLOW_UP_COMMITMENT",
    weight: 14,
    reason: "Committed to a later follow-up",
    patterns: [
      /\b(next (week|thursday|monday|tuesday|friday)|i will (check|confirm|come back)|get back to you|once i have (the )?funds)\b/i,
    ],
  },
  {
    type: "OBJECTION",
    weight: 8,
    reason: "Raised an objection",
    patterns: [/\b(too expensive|cheaper|think about it|not sure|competitor)\b/i],
  },
  {
    type: "COMPARISON",
    weight: 8,
    reason: "Comparing options",
    patterns: [/\b(vs|versus|compared to|difference between|or the)\b/i],
  },
  {
    type: "SUPPORT_REQUEST",
    weight: -12,
    reason: "Looks like a support request",
    patterns: [/\b(not working|broken|warranty claim|complaint|issue with my)\b/i],
  },
  {
    type: "SPAM",
    weight: -40,
    reason: "Looks like spam or promotion",
    patterns: [/\b(follow me|click (here|link)|crypto|forex signal|make money)\b/i],
  },
  {
    type: "LOW_VALUE_ENGAGEMENT",
    weight: -18,
    reason: "Social engagement without a sales question",
    patterns: [
      /^(nice|wow|great|beautiful|fire|love (this|it))([\s\w]{0,24})?(🔥|❤️|👍)?[\s!.]*$/i,
      /^(🔥|❤️|👍)+[\s!.]*$/,
    ],
  },
];

const PRODUCT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "CAT 320 Excavator", pattern: /\bcat\s?320\b|\bexcavator\b/i },
  { label: "5kVA Solar System", pattern: /\b5\s?kva\b/i },
  { label: "4.2kVA Solar System", pattern: /\b4\.2\s?kva\b/i },
  { label: "Solar system", pattern: /\bsolar\b/i },
  { label: "Roofing", pattern: /\broof(ing)?\b/i },
];

const LOCATION_PATTERN =
  /\b(harare|bulawayo|ruwa|chitungwiza|gweru|mutare|kwekwe|victoria falls|lusaka|kitwe|ndola|johannesburg|nairobi|mombasa)\b/i;

function bandFor(score: number): SocialIntentBand {
  if (score >= SCORE_HOT_MIN) return "hot";
  if (score >= SCORE_WARM_MIN) return "warm";
  return "cold";
}

function detectProduct(text: string): string | null {
  for (const row of PRODUCT_PATTERNS) {
    if (row.pattern.test(text)) return row.label;
  }
  return null;
}

function detectLocation(text: string): string | null {
  const m = text.match(LOCATION_PATTERN);
  if (!m) return null;
  const raw = m[1] ?? m[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function recommendedAction(signals: Set<SocialIntentSignalType>, score: number): {
  label: string;
  code: string;
} {
  if (signals.has("SPAM") || (signals.has("LOW_VALUE_ENGAGEMENT") && score < 20)) {
    return { label: "No sales action needed", code: "ignore" };
  }
  if (signals.has("QUOTATION_REQUEST")) {
    return { label: "Reply and create quotation", code: "create_quote" };
  }
  if (signals.has("FOLLOW_UP_COMMITMENT")) {
    return { label: "Confirm follow-up date", code: "create_follow_up" };
  }
  if (score >= SCORE_HOT_MIN) {
    return { label: "Reply and convert to lead", code: "convert_lead" };
  }
  if (signals.has("CALLBACK_REQUEST")) {
    return { label: "Call back and log the conversation", code: "callback" };
  }
  if (score >= SCORE_WARM_MIN) {
    return { label: "Reply with product details", code: "reply" };
  }
  return { label: "Reply if useful", code: "reply" };
}

export function classifySocialIntent(input: ClassifyInput): IntentClassification {
  const text = (input.text ?? "").trim();
  if (!text) {
    return {
      score: 0,
      band: "cold",
      signals: [],
      reasons: [],
      detectedProduct: null,
      detectedLocation: null,
      recommendedAction: "Wait for a customer message",
      recommendedActionCode: "wait",
      followUpHint: null,
      isOpportunity: false,
    };
  }

  const found: SocialIntentSignal[] = [];
  let score = input.conversationKind === "dm" ? 8 : 0;

  for (const row of SIGNAL_PATTERNS) {
    const hit = row.patterns.find((p) => p.test(text));
    if (!hit) continue;
    const excerpt = text.length > 140 ? `${text.slice(0, 137)}...` : text;
    found.push({
      type: row.type,
      confidence: Math.min(0.95, 0.55 + row.weight / 80),
      evidence: excerpt,
      source: "rules",
    });
    score += row.weight;
  }

  if (found.length === 0) {
    found.push({
      type: "OTHER",
      confidence: 0.3,
      evidence: text.slice(0, 140),
      source: "rules",
    });
  }

  const types = new Set(found.map((s) => s.type));
  if (types.has("PRICING_INTENT") && types.has("AVAILABILITY_INTENT")) score += 8;
  if (types.has("PRICING_INTENT") && types.has("FINANCING_INTENT")) score += 6;
  if (types.has("LOCATION_QUERY") && types.has("INSTALLATION_QUERY")) score += 6;
  if (types.has("SPAM")) score = Math.min(score, 8);
  if (types.has("LOW_VALUE_ENGAGEMENT") && found.length === 1) score = Math.min(score, 12);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const reasons = found
    .filter((s) => s.type !== "OTHER" && s.type !== "SPAM")
    .slice(0, 4)
    .map((s) => SIGNAL_PATTERNS.find((p) => p.type === s.type)?.reason ?? s.type.replace(/_/g, " ").toLowerCase());

  const product = detectProduct(text);
  const location = detectLocation(text);
  const rec = recommendedAction(types, score);
  const followUp = types.has("FOLLOW_UP_COMMITMENT")
    ? extractFollowUpHint(text)
    : null;

  const negative = types.has("SPAM") || (types.has("LOW_VALUE_ENGAGEMENT") && score < 25);
  return {
    score,
    band: bandFor(score),
    signals: found,
    reasons: reasons.slice(0, 3),
    detectedProduct: product,
    detectedLocation: location,
    recommendedAction: rec.label,
    recommendedActionCode: rec.code,
    followUpHint: followUp,
    isOpportunity: !negative && score >= SCORE_WARM_MIN,
  };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function extractFollowUpHint(text: string): string | null {
  const lower = text.toLowerCase();
  for (const day of WEEKDAYS) {
    if (lower.includes(day)) {
      return day.charAt(0).toUpperCase() + day.slice(1);
    }
  }
  if (/\bnext week\b/i.test(text)) return "Next week";
  return "Follow up";
}

export function isKnownIntentSignal(value: string): value is SocialIntentSignalType {
  return (SOCIAL_INTENT_SIGNALS as readonly string[]).includes(value);
}

export function mergeClassifications(
  base: IntentClassification,
  extra: IntentClassification | null
): IntentClassification {
  if (!extra) return base;
  const byType = new Map<SocialIntentSignalType, SocialIntentSignal>();
  for (const s of [...base.signals, ...extra.signals]) {
    const prev = byType.get(s.type);
    if (!prev || s.confidence > prev.confidence) byType.set(s.type, s);
  }
  const signals = [...byType.values()];
  const score = Math.max(base.score, extra.score);
  return {
    score,
    band: bandFor(score),
    signals,
    reasons: Array.from(new Set([...extra.reasons, ...base.reasons])).slice(0, 3),
    detectedProduct: extra.detectedProduct || base.detectedProduct,
    detectedLocation: extra.detectedLocation || base.detectedLocation,
    recommendedAction: extra.recommendedAction || base.recommendedAction,
    recommendedActionCode: extra.recommendedActionCode || base.recommendedActionCode,
    followUpHint: extra.followUpHint || base.followUpHint,
    isOpportunity: extra.isOpportunity || base.isOpportunity,
  };
}
