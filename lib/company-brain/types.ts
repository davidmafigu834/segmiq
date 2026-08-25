/**
 * SegmiQ Company Brain — shared types.
 * Company Brain is operating context for the Agent. Canonical CRM records
 * (products, deals, quotations, hours, teams) are referenced, never copied.
 */

export const BUSINESS_KINDS = [
  "manufacturer",
  "distributor",
  "wholesaler",
  "installer",
  "service_provider",
  "rental_company",
  "contractor",
  "dealership",
  "property_agency",
  "other",
] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

export const CUSTOMER_MODELS = ["B2B", "B2C", "BOTH"] as const;
export type CustomerModel = (typeof CUSTOMER_MODELS)[number];

export const VOICE_TONES = [
  "professional",
  "warm",
  "direct",
  "technical",
  "premium",
  "conversational",
] as const;
export type VoiceTone = (typeof VOICE_TONES)[number];

export const RESPONSE_LENGTHS = ["short", "balanced", "detailed"] as const;
export type ResponseLength = (typeof RESPONSE_LENGTHS)[number];

export const EMOJI_POLICIES = ["none", "minimal", "normal"] as const;
export type EmojiPolicy = (typeof EMOJI_POLICIES)[number];

export const SERVICE_AREA_STATUSES = [
  "PRIMARY",
  "EXTENDED",
  "CONFIRMATION_REQUIRED",
  "NOT_SERVED",
] as const;
export type ServiceAreaStatus = (typeof SERVICE_AREA_STATUSES)[number];

export const PLAYBOOK_FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "CURRENCY",
  "BOOLEAN",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "DATE",
  "DATE_RANGE",
  "LOCATION",
  "PHONE",
  "EMAIL",
  "QUANTITY",
  "UNIT",
  "PRODUCT",
] as const;
export type PlaybookFieldType = (typeof PLAYBOOK_FIELD_TYPES)[number];

export const KNOWLEDGE_CATEGORIES = [
  "COMPANY",
  "PRODUCT",
  "PRICING",
  "WARRANTY",
  "SERVICE_AREA",
  "PAYMENT",
  "INSTALLATION",
  "SUPPORT",
  "TERMS",
  "TECHNICAL",
  "FAQ",
  "TRAINING",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_STATUSES = ["DRAFT", "APPROVED", "OUTDATED", "ARCHIVED"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const RULE_TYPES = ["NEVER_SAY", "NEVER_DO"] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const OPERATIONAL_RULE_KEYS = [
  "NEVER_APPLY_DISCOUNT",
  "NEVER_MARK_DEAL_WON",
  "NEVER_MARK_DEAL_LOST",
  "NEVER_SEND_QUOTE",
  "NEVER_BOOK_SUNDAY",
  "NEVER_TROUBLESHOOT",
  "NEVER_SHARE_INTERNAL_NOTES",
  "NEVER_DISCLOSE_MARGINS",
  "NEVER_CHANGE_DEAL_STAGE",
] as const;
export type OperationalRuleKey = (typeof OPERATIONAL_RULE_KEYS)[number];

export const ESCALATION_CONDITION_KEYS = [
  "COMPLAINT",
  "PRICING_DISPUTE",
  "REFUND_REQUEST",
  "DISCOUNT_REQUEST",
  "TECHNICAL_SAFETY",
  "LEGAL_THREAT",
  "CONTRACT_CHANGE",
  "QUOTATION_ABOVE",
  "HIGH_VALUE_DEAL",
  "VIP_CUSTOMER",
  "SPECIFIC_PRODUCT",
  "LOW_CONFIDENCE",
  "CUSTOMER_REQUESTED_HUMAN",
  "AGENT_TOOL_FAILURE",
  "UNSUPPORTED_REQUEST",
  "POLICY_BLOCKED",
  "CONFLICTING_DATA",
] as const;
export type EscalationConditionKey = (typeof ESCALATION_CONDITION_KEYS)[number];

export const ESCALATION_PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;
export type EscalationPriority = (typeof ESCALATION_PRIORITIES)[number];

export const EXAMPLE_CATEGORIES = [
  "NEW_ENQUIRY",
  "PRICING_REQUEST",
  "DISCOUNT_REQUEST",
  "APPOINTMENT_REQUEST",
  "HUMAN_HANDOFF",
  "SUPPORT_REQUEST",
  "COMPLAINT",
  "FOLLOW_UP",
  "QUOTATION_REQUEST",
] as const;
export type ExampleCategory = (typeof EXAMPLE_CATEGORIES)[number];

export const CONTEXT_BUNDLES = [
  "COMPANY_IDENTITY",
  "SALES",
  "QUALIFICATION",
  "PRICING",
  "SCHEDULING",
  "QUOTATION",
  "SUPPORT",
  "WARRANTY",
  "PRODUCT_KNOWLEDGE",
  "CUSTOMER_SERVICE",
  "BRAND_VOICE",
] as const;
export type ContextBundle = (typeof CONTEXT_BUNDLES)[number];

export const SOURCE_TYPES = [
  "system_policy",
  "company_permission",
  "canonical_crm",
  "company_rule",
  "company_brain",
  "approved_faq",
  "approved_document",
  "customer_conversation",
  "customer_memory",
] as const;
export type BrainSourceType = (typeof SOURCE_TYPES)[number];

/** Higher number = higher authority. Model general knowledge is never a source. */
export const SOURCE_AUTHORITY: Record<BrainSourceType, number> = {
  system_policy: 100,
  company_permission: 95,
  canonical_crm: 90,
  company_rule: 85,
  company_brain: 80,
  approved_faq: 70,
  approved_document: 60,
  customer_conversation: 40,
  customer_memory: 35,
};

export type BrainSource = {
  type: BrainSourceType;
  key: string;
  label: string;
  authority: number;
  value?: string;
};

export type PreferredTerm = {
  prefer: string;
  avoid: string;
};

export type PlaybookFieldConditional = {
  field: string;
  op: "equals" | "not_equals" | "truthy" | "falsy";
  value?: string;
};

export type PlaybookField = {
  id: string;
  label: string;
  internalKey: string;
  type: PlaybookFieldType;
  required: boolean;
  possibleValues: string[];
  validation: string | null;
  agentQuestionGuidance: string | null;
  crmMapping: string | null;
  priority: number;
  conditional: PlaybookFieldConditional | null;
};

export type PlaybookTrigger = {
  keywords?: string[];
  itemKinds?: string[];
  conversationType?: string;
};

export type PlaybookCompletion = {
  requireAllRequired?: boolean;
  minRequiredCount?: number;
};

export type QualificationPlaybook = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  appliesTo: string | null;
  trigger: PlaybookTrigger;
  fields: PlaybookField[];
  completion: PlaybookCompletion;
  dealReadiness: Record<string, unknown>;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type IdealCustomer = {
  id: string;
  name: string;
  description: string | null;
  typicalRequirements: string | null;
  minProjectSize: string | null;
  typicalDecisionMaker: string | null;
  primaryInterest: string | null;
  geographicRequirements: string | null;
  goodFitIndicators: string | null;
  poorFitIndicators: string | null;
  disqualifyingConditions: string | null;
  sortOrder: number;
  active: boolean;
};

export type ServiceArea = {
  id: string;
  label: string | null;
  country: string | null;
  province: string | null;
  city: string | null;
  region: string | null;
  radiusKm: number | null;
  serviceCategory: string | null;
  status: ServiceAreaStatus;
  travelChargeApplies: boolean;
  travelChargeNote: string | null;
  minOrder: string | null;
  managerConfirmationRequired: boolean;
  assignedNote: string | null;
  active: boolean;
};

export type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  eligibleUserIds: string[];
  workingHoursSource: "COMPANY" | "SALES" | "SUPPORT" | "CUSTOM";
  customWorkingDays: number[] | null;
  customStartTime: string | null;
  customEndTime: string | null;
  minNoticeHours: number;
  locationRequired: boolean;
  bufferMinutes: number;
  enabled: boolean;
  sortOrder: number;
};

export type StageGuidance = {
  id: string;
  stage: string;
  guidance: string | null;
  preconditions: Array<{ action: string; requires: string; note?: string }>;
};

export type BrainFaq = {
  id: string;
  question: string;
  approvedAnswer: string;
  aliases: string[];
  category: string | null;
  active: boolean;
  productIds: string[];
  lastReviewedAt: string | null;
  reviewerId: string | null;
  version: number;
  updatedAt: string;
};

export type ResponseExample = {
  id: string;
  situation: string;
  customerMessage: string;
  preferredResponse: string;
  whyPreferred: string | null;
  category: ExampleCategory;
  active: boolean;
};

export type AgentRule = {
  id: string;
  ruleType: RuleType;
  text: string;
  structuredKey: OperationalRuleKey | null;
  enabled: boolean;
};

export type EscalationRule = {
  id: string;
  name: string;
  conditionKey: string;
  conditionConfig: Record<string, unknown>;
  destinationType: "USER" | "TEAM" | "OWNER" | "SALES_MANAGER" | "SUPPORT_QUEUE" | "ADMIN";
  destinationId: string | null;
  priority: EscalationPriority;
  customerMessage: string | null;
  enabled: boolean;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  description: string | null;
  storageKey: string | null;
  contentText: string | null;
  status: KnowledgeStatus;
  version: number;
  uploadedById: string | null;
  lastReviewedAt: string | null;
  effectiveDate: string | null;
  expiresAt: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageRef: string | null;
  category: string | null;
  documentTitle?: string;
};

export type CompanyBrainSettings = {
  clientId: string;
  tradingName: string | null;
  businessKind: BusinessKind | null;
  customerModel: CustomerModel | null;
  agentBusinessExplanation: string | null;
  languages: string[];
  primaryOffering: string | null;
  catalogueCustomerType: string | null;
  typicalOrderType: string | null;
  weDoNotNormallySell: string | null;
  specialSellingConditions: string | null;
  pricingGuidance: string | null;
  neverEstimatePrices: boolean;
  creditOffered: boolean;
  paymentPlansOffered: boolean;
  nonstandardTermsRequireApproval: boolean;
  paymentGuidance: string | null;
  supportOffered: boolean;
  supportHoursNote: string | null;
  supportDestinationType: string | null;
  supportDestinationId: string | null;
  supportCategories: string[];
  supportIntakeFields: Array<{ key: string; label: string; required?: boolean }>;
  autonomousTroubleshooting: boolean;
  warrantyBoundaries: string | null;
  voicePrimary: VoiceTone;
  voiceSecondary: VoiceTone | null;
  responseLength: ResponseLength;
  emojiPolicy: EmojiPolicy;
  greetingStyle: string | null;
  preferredTerms: PreferredTerm[];
  claimsToAvoid: string[];
  quoteFollowUpBusinessDays: number;
  secondFollowUpBusinessDays: number;
  maxAutonomousFollowUps: number;
  defaultEscalationMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export const BRAIN_SETTINGS_DEFAULTS: Omit<CompanyBrainSettings, "clientId"> = {
  tradingName: null,
  businessKind: null,
  customerModel: null,
  agentBusinessExplanation: null,
  languages: ["English"],
  primaryOffering: null,
  catalogueCustomerType: null,
  typicalOrderType: null,
  weDoNotNormallySell: null,
  specialSellingConditions: null,
  pricingGuidance: null,
  neverEstimatePrices: true,
  creditOffered: false,
  paymentPlansOffered: false,
  nonstandardTermsRequireApproval: true,
  paymentGuidance: null,
  supportOffered: false,
  supportHoursNote: null,
  supportDestinationType: null,
  supportDestinationId: null,
  supportCategories: [],
  supportIntakeFields: [],
  autonomousTroubleshooting: false,
  warrantyBoundaries: null,
  voicePrimary: "professional",
  voiceSecondary: null,
  responseLength: "short",
  emojiPolicy: "none",
  greetingStyle: null,
  preferredTerms: [],
  claimsToAvoid: [],
  quoteFollowUpBusinessDays: 2,
  secondFollowUpBusinessDays: 5,
  maxAutonomousFollowUps: 2,
  defaultEscalationMessage: null,
  createdAt: null,
  updatedAt: null,
};

export type CanonicalSignals = {
  companyName: string;
  industry: string | null;
  timezone: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country: string | null;
  productCount: number;
  serviceCount: number;
  packageCount: number;
  quoteTemplateCount: number;
  currency: string | null;
  paymentTerms: string | null;
  allowQuotationDiscount: boolean | null;
  priceEditPolicy: string | null;
  hasOperatingHoursRow: boolean;
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
  hasQualificationFlow: boolean;
  teamUserCount: number;
  agentAutonomyMode: string | null;
  quoteAutoSendLimit: number | null;
};

export type CompanyBrainSnapshot = {
  settings: CompanyBrainSettings;
  exists: boolean;
  idealCustomers: IdealCustomer[];
  playbooks: QualificationPlaybook[];
  stageGuidance: StageGuidance[];
  serviceAreas: ServiceArea[];
  appointmentTypes: AppointmentType[];
  faqs: BrainFaq[];
  examples: ResponseExample[];
  rules: AgentRule[];
  escalationRules: EscalationRule[];
  knowledgeDocuments: KnowledgeDocument[];
  canonical: CanonicalSignals;
};

export type RetrievedFact = {
  source: BrainSource;
  text: string;
};

export type CompanyBrainContext = {
  bundles: ContextBundle[];
  facts: RetrievedFact[];
  sources: BrainSource[];
  playbook: QualificationPlaybook | null;
  playbookAmbiguous: boolean;
  playbookCandidates: string[];
  serviceAreaMatch: {
    area: ServiceArea;
    confidence: number;
  } | null;
  serviceAreasUnconfigured: boolean;
  faqs: Array<{ faq: BrainFaq; score: number }>;
  knowledgeChunks: KnowledgeChunk[];
  conflicts: Array<{ topic: string; canonical: string; document: string; sourceLabel: string }>;
  retrievalFailed: boolean;
  why: string[];
};
