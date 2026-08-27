/**
 * Deterministic Learning policy — no I/O.
 * Used by the worker and by unit tests for every spec scenario that can be
 * decided without the database.
 */

import {
  DEFAULT_LEARNING_CONFIG,
  type LearningCategory,
  type LearningConfidenceLevel,
  type LearningConfig,
  type LearningRiskLevel,
  type LearningSettings,
  type LearningSkipReason,
  type LearningType,
  type MessageOrigin,
  type SemanticEditClass,
  type TeachIntent,
} from "./types";

export const COMMERCIAL_TERMS = [
  "price",
  "discount",
  "payment",
  "finance",
  "financing",
  "credit",
  "refund",
  "quotation",
  "warranty",
  "stock",
  "delivery",
  "contract",
  "guarantee",
  "margin",
  "cost",
  "deposit",
  "instalment",
  "installment",
  "terms",
];

export const ONE_OFF_PHRASES = [
  "just this once",
  "special approval",
  "manager approved",
  "for this customer",
  "one-time exception",
  "one time exception",
  "this once",
  "don't tell anyone",
  "dont tell anyone",
  "between us",
];

const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bpassword\s*[:=]\s*\S+/i, label: "password" },
  { re: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+/i, label: "credential" },
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i, label: "token" },
  { re: /\b(?:\d[ -]*?){13,19}\b/, label: "card" },
  { re: /\b(otp|verification code|pin)\s*[:=]?\s*\d{4,8}\b/i, label: "otp" },
  { re: /\bcost\s*(price|of goods)?\s*[:=]?\s*[$£€]?\s*\d/i, label: "cost" },
  { re: /\bmargin\s*[:=]?\s*\d/i, label: "margin" },
];

const GREETING_ONLY = /^(hi|hello|hey|howdy|good\s+(morning|afternoon|evening)|thanks?|thank you|ok(ay)?|k|yes|no|sure|cool|great|cheers|noted|received|seen|👍+|🙏+|😂+|ok thanks)\.?$/i;

const INJECTION_MARKERS = [
  "ignore company brain",
  "ignore your rules",
  "from now on ai",
  "teach the ai",
  "tell your ai",
  "you must learn",
  "everyone gets",
  "act as admin",
  "override policy",
  "system prompt",
];

export function mergeLearningConfig(raw: unknown): LearningConfig {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_LEARNING_CONFIG;
  const bool = (k: keyof LearningConfig, fallback: boolean) =>
    typeof src[k] === "boolean" ? (src[k] as boolean) : fallback;
  const num = (k: keyof LearningConfig, fallback: number, min: number, max: number) => {
    const n = typeof src[k] === "number" && Number.isFinite(src[k] as number) ? (src[k] as number) : fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  return {
    sales: bool("sales", d.sales),
    support: bool("support", d.support),
    copilotEdits: bool("copilotEdits", d.copilotEdits),
    teach: bool("teach", d.teach),
    managerFeedback: bool("managerFeedback", d.managerFeedback),
    internalNotes: bool("internalNotes", d.internalNotes),
    indicators: bool("indicators", d.indicators),
    autoAnalyze: bool("autoAnalyze", d.autoAnalyze),
    retrieval: bool("retrieval", d.retrieval),
    idleMinutes: num("idleMinutes", d.idleMinutes, 3, 180),
    minHumanMessages: num("minHumanMessages", d.minHumanMessages, 1, 20),
    minMeaningfulChars: num("minMeaningfulChars", d.minMeaningfulChars, 20, 2000),
    dailyTokenBudget: num("dailyTokenBudget", d.dailyTokenBudget, 10_000, 5_000_000),
    managersMayDirectApprove: bool("managersMayDirectApprove", d.managersMayDirectApprove),
  };
}

export function isLearningGloballyEnabled(): boolean {
  return process.env.SEGMIQ_LEARNING_DISABLED !== "true";
}

export function isLearningFlagOn(settings: LearningSettings, key: string): boolean {
  if (!isLearningGloballyEnabled()) return false;
  switch (key) {
    case "agent.learning.enabled":
      return settings.enabled;
    case "agent.learning.sales":
      return settings.enabled && settings.config.sales;
    case "agent.learning.support":
      return settings.enabled && settings.config.support;
    case "agent.learning.copilotEdits":
      return settings.enabled && settings.config.copilotEdits;
    case "agent.learning.teach":
      return settings.enabled && settings.config.teach;
    case "agent.learning.indicators":
      return settings.enabled && settings.config.indicators;
    case "agent.learning.autoAnalyze":
      return settings.enabled && settings.config.autoAnalyze;
    case "agent.learning.retrieval":
      return settings.config.retrieval;
    default:
      return false;
  }
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function semanticKey(type: LearningType, category: LearningCategory, title: string): string {
  return `${type}|${category}|${normalizeText(title).slice(0, 160)}`;
}

export function tokenOverlap(a: string, b: string): number {
  const qa = new Set(normalizeText(a).split(" ").filter((t) => t.length >= 2));
  const cb = normalizeText(b).split(" ").filter((t) => t.length >= 2);
  if (!qa.size || !cb.length) return 0;
  let hits = 0;
  for (const t of cb) if (qa.has(t)) hits += 1;
  return hits / Math.max(qa.size, cb.length, 1);
}

export function observationsEquivalent(
  a: { type: string; category: string; title: string; proposedLearning: string },
  b: { type: string; category: string; title: string; proposedLearning: string }
): boolean {
  if (a.category !== b.category) return false;
  if (semanticKey(a.type as LearningType, a.category as LearningCategory, a.title) ===
      semanticKey(b.type as LearningType, b.category as LearningCategory, b.title)) {
    return true;
  }
  const titleScore = tokenOverlap(a.title, b.title);
  const bodyScore = tokenOverlap(a.proposedLearning, b.proposedLearning);
  return titleScore >= 0.55 && bodyScore >= 0.45;
}

export function messageOrigin(opts: {
  direction: "inbound" | "outbound" | string;
  senderSource?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
}): MessageOrigin {
  if (opts.direction === "inbound") return "CUSTOMER";
  const source = (opts.senderSource ?? "").toUpperCase();
  const role = (opts.actorRole ?? "").toUpperCase();
  if (source === "CUSTOMER") return "CUSTOMER";
  if (source === "SEGMIQ_USER" || source === "EXTERNAL_BUSINESS_DEVICE") return "HUMAN_SALESPERSON";
  if (role === "SYSTEM" || source === "SYSTEM") return "AGENT";
  if (opts.actorId && role !== "SYSTEM") return "HUMAN_SALESPERSON";
  return "AGENT";
}

export function isIgnorableMessage(text: string, origin: MessageOrigin): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (origin === "SYSTEM") return true;
  if (GREETING_ONLY.test(trimmed)) return true;
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(trimmed) && trimmed.length < 12) {
    return true;
  }
  if (/^(delivered|read|sent|failed)$/i.test(trimmed)) return true;
  return false;
}

export function redactSecrets(text: string): { text: string; redacted: string[] } {
  let next = text;
  const redacted: string[] = [];
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(next)) {
      next = next.replace(re, `[redacted:${label}]`);
      redacted.push(label);
    }
  }
  return { text: next, redacted };
}

export function stripCustomerPii(text: string): string {
  return text
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, "a customer")
    .replace(/\b(?:\+?\d[\d\s()-]{7,}\d)\b/g, "[phone]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]");
}

export function looksLikePromptInjection(text: string): boolean {
  const n = normalizeText(text);
  return INJECTION_MARKERS.some((m) => n.includes(normalizeText(m)));
}

export function containsDisallowedContent(text: string): boolean {
  const { redacted } = redactSecrets(text);
  if (redacted.length) return true;
  if (/\bpassword\b/i.test(text) && /\b(is|was|=|:)\b/i.test(text)) return true;
  return false;
}

export function looksLikeOneOffException(text: string): boolean {
  const n = normalizeText(text);
  return ONE_OFF_PHRASES.some((p) => n.includes(normalizeText(p)));
}

export function classifyCommercialRisk(text: string, category?: LearningCategory): LearningRiskLevel {
  const n = normalizeText(text);
  const commercialHits = COMMERCIAL_TERMS.filter((t) => n.includes(t));
  if (category === "COMMERCIAL_PATTERN" || commercialHits.length >= 2) return "VERY_HIGH";
  if (commercialHits.length === 1) return "HIGH";
  if (category === "PRODUCT_EXPLANATION" || category === "ESCALATION") return "HIGH";
  if (category === "QUALIFICATION" || category === "SALES_PROCESS" || category === "FAQ") return "MEDIUM";
  if (category === "TONE" || category === "CUSTOMER_LANGUAGE" || category === "FOLLOW_UP") return "LOW";
  return "MEDIUM";
}

export function classifyEdit(original: string, edited: string): SemanticEditClass {
  const a = original.trim();
  const b = edited.trim();
  if (!a || !b) return "TRIVIAL_EDIT";
  if (a === b) return "TRIVIAL_EDIT";

  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return "TRIVIAL_EDIT";

  const punctOnly = a.replace(/[\s.!,;:'"]+/g, "") === b.replace(/[\s.!,;:'"]+/g, "");
  if (punctOnly) return "TRIVIAL_EDIT";

  const overlap = tokenOverlap(a, b);
  if (overlap >= 0.92 && Math.abs(a.length - b.length) < 12) return "TRIVIAL_EDIT";

  const commercial = classifyCommercialRisk(`${a} ${b}`);
  if (commercial === "VERY_HIGH" || /discount|payment|credit|warranty|price/i.test(b)) {
    return "COMMERCIAL_CORRECTION";
  }
  if (/definitely|guarantee|will run|will power|confirm with (the )?technical|technical team/i.test(`${a} ${b}`)) {
    return "TECHNICAL_CORRECTION";
  }
  if (/never|don't say|do not|policy|credit offered|cannot offer/i.test(b)) {
    return "POLICY_CORRECTION";
  }
  if (overlap < 0.55) return "FACTUAL_CORRECTION";
  return "TONE_EDIT";
}

export function isMeaningfulCorrection(cls: SemanticEditClass): boolean {
  return (
    cls === "FACTUAL_CORRECTION" ||
    cls === "POLICY_CORRECTION" ||
    cls === "TECHNICAL_CORRECTION" ||
    cls === "COMMERCIAL_CORRECTION"
  );
}

export type EligibilityInput = {
  learningEnabled: boolean;
  globallyEnabled: boolean;
  autoAnalyze: boolean;
  excluded: boolean;
  conversationType: "SALES" | "SUPPORT" | "GENERAL" | string;
  salesSourceOn: boolean;
  supportSourceOn: boolean;
  humanMessageCount: number;
  meaningfulCharCount: number;
  hasCustomerMessage: boolean;
  entirelyAgentGenerated: boolean;
  systemOnly: boolean;
  privateConversation: boolean;
  minHumanMessages: number;
  minMeaningfulChars: number;
};

export function evaluateEligibility(input: EligibilityInput): { eligible: true } | { eligible: false; reason: LearningSkipReason } {
  if (!input.globallyEnabled || !input.learningEnabled) return { eligible: false, reason: "LEARNING_DISABLED" };
  if (!input.autoAnalyze) return { eligible: false, reason: "FEATURE_FLAG_OFF" };
  if (input.excluded) return { eligible: false, reason: "CONVERSATION_EXCLUDED" };
  if (input.privateConversation) return { eligible: false, reason: "PRIVATE_CONVERSATION" };
  if (input.conversationType === "SUPPORT" && !input.supportSourceOn) {
    return { eligible: false, reason: "SOURCE_DISABLED" };
  }
  if (input.conversationType !== "SUPPORT" && !input.salesSourceOn) {
    return { eligible: false, reason: "SOURCE_DISABLED" };
  }
  if (input.systemOnly) return { eligible: false, reason: "NO_HUMAN_MESSAGES" };
  if (input.entirelyAgentGenerated) return { eligible: false, reason: "NO_HUMAN_MESSAGES" };
  if (input.humanMessageCount < input.minHumanMessages) return { eligible: false, reason: "NO_HUMAN_MESSAGES" };
  if (!input.hasCustomerMessage && input.humanMessageCount < 2) {
    return { eligible: false, reason: "INSUFFICIENT_CONTENT" };
  }
  if (input.meaningfulCharCount < input.minMeaningfulChars) {
    return { eligible: false, reason: "INSUFFICIENT_CONTENT" };
  }
  return { eligible: true };
}

export function computeConfidence(opts: {
  conversationCount: number;
  salespersonCount: number;
  isExplicitTeach?: boolean;
  isCorrection?: boolean;
  isConflict?: boolean;
  isSafety?: boolean;
  oneOffException?: boolean;
  recencyDays?: number;
}): LearningConfidenceLevel {
  if (opts.oneOffException) return "LOW";
  if (opts.isExplicitTeach || opts.isCorrection || opts.isSafety) {
    if (opts.salespersonCount >= 2 || opts.conversationCount >= 3) return "HIGH";
    return "MEDIUM";
  }
  if (opts.isConflict) {
    return opts.conversationCount >= 2 ? "MEDIUM" : "LOW";
  }
  if (opts.salespersonCount >= 4 && opts.conversationCount >= 20) return "HIGH";
  if (opts.salespersonCount >= 3 && opts.conversationCount >= 10) return "HIGH";
  if (opts.salespersonCount >= 2 && opts.conversationCount >= 5) return "MEDIUM";
  if (opts.conversationCount >= 8 && opts.salespersonCount >= 2) return "MEDIUM";
  return "LOW";
}

export function shouldSurfaceCandidate(opts: {
  conversationCount: number;
  salespersonCount: number;
  isExplicitTeach?: boolean;
  isCorrection?: boolean;
  isSafety?: boolean;
  isConflict?: boolean;
  oneOffException?: boolean;
  riskLevel: LearningRiskLevel;
}): boolean {
  if (opts.isExplicitTeach || opts.isCorrection || opts.isSafety || opts.isConflict) return true;
  if (opts.oneOffException) {
    return opts.riskLevel === "VERY_HIGH" || opts.riskLevel === "HIGH";
  }
  return opts.conversationCount >= 3 && opts.salespersonCount >= 2;
}

export function suppressionAllowsResurface(opts: {
  evidenceAtRejection: number;
  currentEvidenceCount: number;
  currentSalespersonCount: number;
  daysSinceRejection: number;
}): boolean {
  const stronger =
    opts.currentEvidenceCount >= Math.max(opts.evidenceAtRejection * 3, opts.evidenceAtRejection + 8);
  const team = opts.currentSalespersonCount >= 3;
  const cooled = opts.daysSinceRejection >= 21;
  return stronger && team && cooled;
}

export function jobFingerprint(opts: {
  clientId: string;
  conversationId: string;
  source: string;
  segmentStartId?: string | null;
  segmentEndId?: string | null;
  extractorVersion: string;
  extra?: string;
}): string {
  const start = opts.segmentStartId ?? "pending";
  const end = opts.segmentEndId ?? "open";
  return [
    opts.clientId,
    opts.conversationId,
    opts.source,
    start,
    end,
    opts.extractorVersion,
    opts.extra ?? "",
  ].join(":");
}

export function pendingConversationFingerprint(clientId: string, conversationId: string): string {
  return `${clientId}:${conversationId}:CONVERSATION_SEGMENT:pending`;
}

export function teachIntentToType(intent: TeachIntent): LearningType {
  if (intent === "WRONG_RESPONSE" || intent === "NEVER_RESPOND_THIS_WAY") return "CORRECTION";
  if (intent === "ADD_TERMINOLOGY") return "TERMINOLOGY";
  if (intent === "ADD_AS_FAQ") return "NEW_KNOWLEDGE";
  return "BEHAVIOR_PATTERN";
}

export function teachIntentToCategory(intent: TeachIntent): LearningCategory {
  if (intent === "ADD_AS_FAQ") return "FAQ";
  if (intent === "ADD_TO_PLAYBOOK") return "QUALIFICATION";
  if (intent === "ADD_TERMINOLOGY") return "CUSTOMER_LANGUAGE";
  if (intent === "NEVER_RESPOND_THIS_WAY") return "TONE";
  return "QUALIFICATION";
}

export type AgentPreset = "LEARN_FIRST" | "ASSIST";

export function presetPatch(preset: AgentPreset): {
  enabled: boolean;
  suggestReplies: boolean;
  learningEnabled: boolean;
  proactiveEnabled: boolean;
  autonomyMode?: "ASSIST" | "COPILOT" | "AUTOPILOT";
} {
  if (preset === "ASSIST") {
    return {
      enabled: false,
      suggestReplies: true,
      learningEnabled: true,
      proactiveEnabled: false,
      autonomyMode: "ASSIST",
    };
  }
  return {
    enabled: false,
    suggestReplies: false,
    learningEnabled: true,
    proactiveEnabled: false,
  };
}

export function independentStates(opts: {
  customerAgentEnabled: boolean;
  proactiveEnabled: boolean;
  learningEnabled: boolean;
}): {
  customerAgent: "Responding" | "Not responding";
  proactive: "Active" | "Paused";
  learning: "Active" | "Off";
} {
  return {
    customerAgent: opts.customerAgentEnabled ? "Responding" : "Not responding",
    proactive: opts.proactiveEnabled ? "Active" : "Paused",
    learning: opts.learningEnabled ? "Active" : "Off",
  };
}

export function salesHubStatusCopy(opts: {
  customerAgentEnabled: boolean;
  learningEnabled: boolean;
}): { agent: string; learning: string; combined: string; tooltip: string } {
  const agent = opts.customerAgentEnabled ? "Responding" : "Not responding";
  const learning = opts.learningEnabled ? "Active" : "Off";
  const combined = opts.customerAgentEnabled
    ? opts.learningEnabled
      ? "Agent responding · Learning active"
      : "Agent responding"
    : opts.learningEnabled
      ? "Agent paused · Learning active"
      : "Agent not responding";
  const tooltip = opts.customerAgentEnabled
    ? "SegmiQ may reply to this customer under company autonomy settings."
    : opts.learningEnabled
      ? "SegmiQ is not responding to this customer. It may learn approved sales patterns from eligible human conversations."
      : "SegmiQ is not responding to this customer.";
  return { agent, learning, combined, tooltip };
}

export function retrievalIsRelevant(opts: {
  customerMessage: string;
  intents?: string[];
  knowledge: { category: string; title: string; content: string; intentHints?: string[] };
}): boolean {
  const hay = normalizeText(
    `${opts.customerMessage} ${(opts.intents ?? []).join(" ")} ${opts.knowledge.intentHints?.join(" ") ?? ""}`
  );
  const needle = normalizeText(`${opts.knowledge.category} ${opts.knowledge.title} ${opts.knowledge.content}`);
  const overlap = tokenOverlap(hay, needle);
  if (overlap >= 0.12) return true;
  const hints = opts.knowledge.intentHints ?? [];
  if (hints.some((h) => hay.includes(normalizeText(h)))) return true;

  const categoryTriggers: Record<string, string[]> = {
    QUALIFICATION: ["need", "want", "borehole", "load", "appliance", "house", "solar", "package", "system"],
    FAQ: ["include", "installation", "warranty", "how long", "does it"],
    OBJECTION_HANDLING: ["cheaper", "competitor", "discount", "price", "expensive"],
    COMMERCIAL_PATTERN: ["price", "pay", "discount", "credit"],
    ESCALATION: ["technical", "inverter", "error", "complaint"],
    FOLLOW_UP: ["later", "not ready", "next week", "follow"],
    APPOINTMENT_PATTERN: ["visit", "site", "come", "appointment"],
    SUPPORT_PATTERN: ["not working", "broken", "fault", "support"],
    PRODUCT_EXPLANATION: ["package", "battery", "inverter", "kva", "kwh"],
    TONE: [],
    SALES_PROCESS: ["quote", "proposal", "site assessment"],
    CUSTOMER_LANGUAGE: [],
    CLOSING_PATTERN: ["ready", "go ahead", "proceed", "accept"],
  };
  const triggers = categoryTriggers[opts.knowledge.category] ?? [];
  const hits = triggers.filter((t) => hay.includes(t)).length;
  if (opts.knowledge.category === "TONE") return hits >= 0 && hay.length > 0 && overlap >= 0.04;
  return hits >= 2 || (hits >= 1 && overlap >= 0.06);
}

export function intentHintsForCategory(category: LearningCategory): string[] {
  switch (category) {
    case "QUALIFICATION":
      return ["NEW_SALES_ENQUIRY", "QUALIFICATION_RESPONSE", "PRODUCT_QUESTION"];
    case "FAQ":
      return ["PRODUCT_QUESTION", "GENERAL_MESSAGE"];
    case "OBJECTION_HANDLING":
      return ["DISCOUNT_REQUEST", "PRICING_REQUEST"];
    case "COMMERCIAL_PATTERN":
      return ["PRICING_REQUEST", "DISCOUNT_REQUEST", "QUOTATION_REQUEST"];
    case "ESCALATION":
      return ["SUPPORT_REQUEST", "COMPLAINT", "HUMAN_REQUEST"];
    case "FOLLOW_UP":
      return ["FOLLOW_UP_REQUEST", "CALLBACK_REQUEST"];
    case "APPOINTMENT_PATTERN":
      return ["APPOINTMENT_REQUEST", "RESCHEDULE_REQUEST"];
    case "SUPPORT_PATTERN":
      return ["SUPPORT_REQUEST", "COMPLAINT"];
    default:
      return ["NEW_SALES_ENQUIRY", "PRODUCT_QUESTION", "GENERAL_MESSAGE"];
  }
}

export function knowledgeSourceFromCandidate(source: string, type: LearningType): "SALES_TEAM_LEARNING" | "MANAGER_TAUGHT" | "HUMAN_CORRECTION" {
  if (source === "TEACH_SEGMIQ") return "MANAGER_TAUGHT";
  if (type === "CORRECTION" || source === "HUMAN_CORRECTION") return "HUMAN_CORRECTION";
  return "SALES_TEAM_LEARNING";
}

export function isSurfacedCandidate(opts: {
  conversationCount: number;
  salespersonCount: number;
  type: string;
  source: string;
  comparisonState: string;
  riskLevel: LearningRiskLevel;
}): boolean {
  return shouldSurfaceCandidate({
    conversationCount: opts.conversationCount,
    salespersonCount: opts.salespersonCount,
    isExplicitTeach: opts.source === "TEACH_SEGMIQ",
    isCorrection: opts.type === "CORRECTION" || opts.source === "HUMAN_CORRECTION",
    isSafety: opts.type === "CORRECTION",
    isConflict: opts.comparisonState === "CONFLICTS" || opts.type === "CONFLICT",
    oneOffException: false,
    riskLevel: opts.riskLevel,
  });
}

/** Chat never becomes the Product, Package, price, or quotation database. */
export function canonicalFactAuthority(
  kind: "PRICE" | "WARRANTY" | "PACKAGE_COMPOSITION" | "QUOTATION" | "PAYMENT_TERMS" | "BEHAVIOR"
): "PRODUCT" | "PACKAGE" | "QUOTATION" | "COMPANY_BRAIN" | "LEARNED_KNOWLEDGE" {
  if (kind === "PRICE" || kind === "WARRANTY") return "PRODUCT";
  if (kind === "PACKAGE_COMPOSITION") return "PACKAGE";
  if (kind === "QUOTATION") return "QUOTATION";
  if (kind === "PAYMENT_TERMS") return "COMPANY_BRAIN";
  return "LEARNED_KNOWLEDGE";
}

export function conversationMayEstablishCanonicalFact(kind: Parameters<typeof canonicalFactAuthority>[0]): boolean {
  return kind === "BEHAVIOR";
}

export function proposedLearningConflictsProductFact(opts: {
  proposedLearning: string;
  productWarrantyYears?: number | null;
}): boolean {
  if (opts.productWarrantyYears == null) return false;
  const match = opts.proposedLearning.match(/(\d+)\s*-?\s*year/i);
  if (!match) return false;
  return Number(match[1]) !== opts.productWarrantyYears;
}

export function oneOffMustNotGeneralizeDiscount(text: string): boolean {
  return looksLikeOneOffException(text) && /discount|%|percent/i.test(text);
}

export function treatCustomerTextAsData(text: string): { isInjection: boolean; mayUpdatePolicy: false } {
  return { isInjection: looksLikePromptInjection(text), mayUpdatePolicy: false };
}

export function filterUnsafeProposedLearning(text: string): string | null {
  const redacted = redactSecrets(text).text;
  if (containsDisallowedContent(redacted)) return null;
  if (looksLikePromptInjection(redacted) && /discount|free|ignore/i.test(redacted)) return null;
  return redacted.slice(0, 1200);
}
