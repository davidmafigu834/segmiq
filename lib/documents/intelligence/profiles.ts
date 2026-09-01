import type { DocumentFactType } from "@/lib/documents/intelligence/types";

export type ExtractionProfile = {
  documentTypeCode: string;
  label: string;
  focusFields: DocumentFactType[];
  obligationHints: string[];
  promptHints: string;
};

export const SYSTEM_EXTRACTION_PROFILES: ExtractionProfile[] = [
  {
    documentTypeCode: "CONTRACT",
    label: "Contract",
    focusFields: [
      "PARTY",
      "SIGNATORY",
      "CONTRACT_VALUE",
      "CURRENCY",
      "EFFECTIVE_DATE",
      "EXPIRY_DATE",
      "RENEWAL_DATE",
      "NOTICE_PERIOD",
      "PAYMENT_TERM",
      "DEPOSIT",
      "DELIVERY_TERM",
      "WARRANTY_TERM",
      "TERMINATION_TERM",
    ],
    obligationHints: [
      "Company obligations",
      "Customer obligations",
      "Delivery milestones",
      "Reporting duties",
      "Payment triggers",
    ],
    promptHints:
      "Extract parties, commercial value, payment schedule, renewal/termination, and obligations only when explicitly stated.",
  },
  {
    documentTypeCode: "INVOICE",
    label: "Invoice",
    focusFields: [
      "DOCUMENT_REFERENCE",
      "INVOICE_TOTAL",
      "INVOICE_DUE_DATE",
      "CURRENCY",
      "PO_NUMBER",
      "PARTY",
    ],
    obligationHints: ["Payment due", "Late payment consequences if stated"],
    promptHints:
      "Extract invoice number, issuer, recipient, issue/due dates, subtotal/tax/total, currency, and referenced PO. Do not perform accounting reconciliation.",
  },
  {
    documentTypeCode: "PURCHASE_ORDER",
    label: "Purchase order",
    focusFields: ["PO_NUMBER", "PARTY", "CURRENCY", "DELIVERY_TERM", "PROJECT_LOCATION"],
    obligationHints: ["Delivery requirements", "Acceptance criteria if stated"],
    promptHints: "Extract PO number, supplier/customer, line items summary, amounts, currency, and delivery requirements.",
  },
  {
    documentTypeCode: "INSURANCE",
    label: "Insurance policy",
    focusFields: ["POLICY_NUMBER", "PARTY", "EFFECTIVE_DATE", "EXPIRY_DATE", "CURRENCY"],
    obligationHints: ["Coverage obligations", "Notification duties"],
    promptHints: "Extract policy number, insurer, insured party, coverage summary, effective and expiry dates.",
  },
  {
    documentTypeCode: "LICENCE",
    label: "Licence / permit",
    focusFields: ["LICENCE_NUMBER", "PARTY", "EFFECTIVE_DATE", "EXPIRY_DATE", "PROJECT_LOCATION"],
    obligationHints: ["Compliance conditions", "Renewal obligations"],
    promptHints: "Extract licence number, issuing authority, holder, validity period, and conditions.",
  },
  {
    documentTypeCode: "NDA",
    label: "NDA",
    focusFields: ["PARTY", "EFFECTIVE_DATE", "EXPIRY_DATE", "TERMINATION_TERM", "NOTICE_PERIOD"],
    obligationHints: ["Confidentiality duties", "Return/destruction obligations"],
    promptHints: "Extract parties, term, confidentiality scope, and termination/notice provisions.",
  },
];

const DEFAULT_PROFILE: ExtractionProfile = {
  documentTypeCode: "OTHER",
  label: "General document",
  focusFields: ["DOCUMENT_REFERENCE", "PARTY", "EFFECTIVE_DATE", "EXPIRY_DATE"],
  obligationHints: ["Stated duties or requirements"],
  promptHints: "Extract only clearly stated commercial or operational facts. Do not invent missing fields.",
};

export function getExtractionProfile(documentTypeCode: string | null | undefined): ExtractionProfile {
  if (!documentTypeCode) return DEFAULT_PROFILE;
  return (
    SYSTEM_EXTRACTION_PROFILES.find((p) => p.documentTypeCode === documentTypeCode) ?? DEFAULT_PROFILE
  );
}

export function formatFactValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (record.amount != null && record.currency) {
      return `${record.amount} ${record.currency}`;
    }
    if (record.amount != null) return String(record.amount);
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

export function formatSourceEvidence(opts: {
  page?: number | null;
  clause?: string | null;
  section?: string | null;
}): string {
  const parts: string[] = [];
  if (opts.clause) parts.push(`Clause ${opts.clause}`);
  if (opts.section) parts.push(opts.section);
  if (opts.page != null) parts.push(`Page ${opts.page}`);
  return parts.join(" · ") || "Source in document";
}
