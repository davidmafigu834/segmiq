import type { ContextBundle } from "./types";

export const BRAIN_AREAS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Business Profile" },
  { id: "catalogue", label: "What We Sell" },
  { id: "customers", label: "Ideal Customers" },
  { id: "qualification", label: "Qualification" },
  { id: "sales-process", label: "Sales Process" },
  { id: "service-areas", label: "Service Areas" },
  { id: "hours", label: "Business Hours" },
  { id: "pricing", label: "Pricing & Payments" },
  { id: "support", label: "Support" },
  { id: "voice", label: "Brand Voice" },
  { id: "faqs", label: "FAQs" },
  { id: "examples", label: "Response Examples" },
  { id: "rules", label: "Agent Rules" },
  { id: "escalation", label: "Escalation" },
  { id: "knowledge", label: "Knowledge Library" },
  { id: "test", label: "Test Agent" },
] as const;

export type BrainAreaId = (typeof BRAIN_AREAS)[number]["id"];

export const BUSINESS_KIND_LABELS: Record<string, string> = {
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  wholesaler: "Wholesaler",
  installer: "Installer",
  service_provider: "Service provider",
  rental_company: "Rental company",
  contractor: "Contractor",
  dealership: "Dealership",
  property_agency: "Property agency",
  other: "Other",
};

export const DEAL_STAGES = [
  "QUALIFIED",
  "SCOPING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "LOST",
] as const;

export const DEAL_STAGE_LABELS: Record<string, string> = {
  QUALIFIED: "Qualified",
  SCOPING: "Scoping",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATING: "Negotiating",
  WON: "Won",
  LOST: "Lost",
};

export const TOKEN_BUDGET = {
  identityChars: 900,
  salesChars: 700,
  qualificationChars: 1400,
  pricingChars: 700,
  schedulingChars: 600,
  supportChars: 700,
  voiceChars: 500,
  faqChars: 900,
  documentChars: 1200,
  examplesChars: 800,
  rulesChars: 800,
  totalChars: 6500,
} as const;

export const INTENT_BUNDLE_HINTS: Array<{
  pattern: RegExp;
  bundles: ContextBundle[];
  topic: string;
}> = [
  {
    pattern: /\b(open|close|hours?|after.?hours|sunday|saturday|today|tomorrow|available|availability|visit|appointment|book|schedule|callback|site visit|come (by|out|over))\b/i,
    bundles: ["SCHEDULING"],
    topic: "scheduling",
  },
  {
    pattern: /\b(price|pricing|cost|how much|quote|quotation|discount|cheap|cheapest|deposit|pay|payment|credit|finance|installment)\b/i,
    bundles: ["PRICING", "QUOTATION"],
    topic: "pricing",
  },
  {
    pattern: /\b(warranty|warranties|guarantee|guaranteed)\b/i,
    bundles: ["WARRANTY", "PRODUCT_KNOWLEDGE"],
    topic: "warranty",
  },
  {
    pattern: /\b(install|installation|deliver|delivery|cover|coverage|serve|service area|operate in|come to|in (harare|mutare|bulawayo|gweru|kwekwe))\b/i,
    bundles: ["SALES", "COMPANY_IDENTITY"],
    topic: "service_area",
  },
  {
    pattern: /\b(error|fault|broken|not working|warranty claim|support|repair|issue|problem|complaint|angry|refund)\b/i,
    bundles: ["SUPPORT", "CUSTOMER_SERVICE"],
    topic: "support",
  },
  {
    pattern: /\b(spec|specification|kva|inverter|battery|panel|excavator|crane|model|package|product|stock|available)\b/i,
    bundles: ["PRODUCT_KNOWLEDGE", "SALES"],
    topic: "product",
  },
];

export const CORE_BUNDLES: ContextBundle[] = ["COMPANY_IDENTITY", "BRAND_VOICE"];
