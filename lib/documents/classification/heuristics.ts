import type { ClassificationResult, ClassificationTypeCode } from "@/lib/documents/classification/types";

type Rule = {
  code: ClassificationTypeCode;
  filename: RegExp[];
  content: RegExp[];
  weight: number;
};

const RULES: Rule[] = [
  {
    code: "CONTRACT",
    filename: [/contract/i, /agreement/i, /msa/i, /sla/i],
    content: [/agreement/i, /parties/i, /whereas/i, /terms and conditions/i],
    weight: 1,
  },
  {
    code: "PROPOSAL",
    filename: [/proposal/i, /quotation/i, /quote/i],
    content: [/proposal/i, /scope of work/i, /valid until/i],
    weight: 1,
  },
  {
    code: "INVOICE",
    filename: [/invoice/i, /inv-/i, /tax invoice/i],
    content: [/invoice\s*(number|no)/i, /amount due/i, /subtotal/i],
    weight: 1,
  },
  {
    code: "PURCHASE_ORDER",
    filename: [/purchase[-_\s]?order/i, /\bpo[-_\s]?\d/i],
    content: [/purchase order/i, /\bPO\b/i],
    weight: 1,
  },
  {
    code: "INSURANCE",
    filename: [/insurance/i, /policy/i],
    content: [/policy number/i, /coverage/i, /insured/i],
    weight: 0.9,
  },
  {
    code: "LICENCE",
    filename: [/licen[cs]e/i, /permit/i],
    content: [/licen[cs]e number/i, /issuing authority/i],
    weight: 0.9,
  },
  {
    code: "CERTIFICATE",
    filename: [/certificate/i, /cert\b/i],
    content: [/certificate of/i, /this certifies/i],
    weight: 0.9,
  },
  {
    code: "COMPANY_POLICY",
    filename: [/policy/i, /handbook/i],
    content: [/company policy/i, /employees must/i, /applicability/i],
    weight: 0.85,
  },
  {
    code: "NDA",
    filename: [/nda/i, /non[-\s]?disclosure/i],
    content: [/confidential information/i, /non[-\s]?disclosure/i],
    weight: 1,
  },
  {
    code: "TENDER_DOCUMENT",
    filename: [/tender/i, /rfp/i, /rfq/i],
    content: [/request for proposal/i, /tender/i],
    weight: 0.9,
  },
  {
    code: "TECHNICAL_DOCUMENT",
    filename: [/datasheet/i, /spec/i, /manual/i],
    content: [/specifications/i, /technical data/i],
    weight: 0.8,
  },
  {
    code: "EMPLOYEE_DOCUMENT",
    filename: [/employment/i, /offer letter/i, /hr/i],
    content: [/employee/i, /employment/i],
    weight: 0.8,
  },
];

const TYPE_TO_DEFAULT_CATEGORY: Partial<Record<ClassificationTypeCode, string>> = {
  CONTRACT: "Client Contracts",
  PROPOSAL: "Proposals",
  INVOICE: "Invoices",
  PURCHASE_ORDER: "Supplier Documents",
  INSURANCE: "Compliance",
  LICENCE: "Compliance",
  CERTIFICATE: "Compliance",
  COMPANY_POLICY: "Policies",
  NDA: "Legal Documents",
  TENDER_DOCUMENT: "Tenders",
  TECHNICAL_DOCUMENT: "Technical Documents",
  SUPPLIER_DOCUMENT: "Supplier Documents",
  CUSTOMER_DOCUMENT: "Client Documents",
};

function scoreRule(rule: Rule, filename: string, sample: string): number {
  let score = 0;
  if (rule.filename.some((rx) => rx.test(filename))) score += 0.55 * rule.weight;
  if (rule.content.some((rx) => rx.test(sample))) score += 0.45 * rule.weight;
  return score;
}

export function classifyHeuristically(opts: {
  filename: string;
  textSample: string;
}): ClassificationResult {
  const filename = opts.filename;
  const sample = opts.textSample.slice(0, 8000);
  let bestCode: ClassificationTypeCode = "OTHER";
  let bestScore = 0;

  for (const rule of RULES) {
    const score = scoreRule(rule, filename, sample);
    if (score > bestScore) {
      bestScore = score;
      bestCode = rule.code;
    }
  }

  const typeConfidence =
    bestScore >= 0.75 ? "HIGH" : bestScore >= 0.45 ? "MEDIUM" : bestScore > 0.2 ? "LOW" : "LOW";

  const tags: string[] = [];
  if (/\bsigned\b/i.test(sample) || /signed/i.test(filename)) tags.push("Signed");
  if (/\bdraft\b/i.test(sample) || /draft/i.test(filename)) tags.push("Draft");
  if (/\bamendment\b/i.test(sample)) tags.push("Amendment");

  const lifecycleHint = tags.includes("Signed")
    ? "SIGNED"
    : tags.includes("Draft")
      ? "DRAFT"
      : null;

  return {
    documentTypeCode: bestCode,
    typeConfidence: typeConfidence === "LOW" && bestCode !== "OTHER" ? "MEDIUM" : typeConfidence,
    suggestedCategoryName: TYPE_TO_DEFAULT_CATEGORY[bestCode] ?? null,
    categoryConfidence: bestScore >= 0.6 ? "HIGH" : bestScore >= 0.35 ? "MEDIUM" : "LOW",
    tags,
    lifecycleHint,
    titleHint: null,
    reasoning: `Heuristic score ${bestScore.toFixed(2)} for ${bestCode}`,
  };
}
