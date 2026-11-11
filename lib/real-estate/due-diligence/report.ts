import { compareNames, comparePlaces, compareStands } from "@/lib/real-estate/due-diligence/compare";
import { requiredDocumentTypes } from "@/lib/real-estate/due-diligence/rules";
import { decideStatus, scoreRisk } from "@/lib/real-estate/due-diligence/scoring";
import {
  DOCUMENT_LABEL,
  type ChecklistItem,
  type ComparisonRow,
  type DocumentType,
  type DueDiligenceCheck,
  type Evaluation,
  type EvaluationInput,
} from "@/lib/real-estate/due-diligence/types";

/** Asking prices at or above this figure always get a conveyancer recommendation. Not a statutory threshold. */
export const CONVEYANCER_REVIEW_PRICE_USD = 100_000;

const PROPERTY_TYPES: DocumentType[] = [
  "title_deed",
  "cession_agreement",
  "agreement_of_sale",
  "subdivision_permit",
  "development_permit",
  "certificate_of_compliance",
];

function cells(input: EvaluationInput, read: (document: EvaluationInput["documents"][number]) => string | null) {
  return input.documents.flatMap((document) => {
    const value = read(document);
    if (!value) return [];
    return [{
      documentId: document.id,
      documentType: DOCUMENT_LABEL[document.declaredType],
      fileName: document.fileName,
      value,
    }];
  });
}

export function buildComparison(input: EvaluationInput): ComparisonRow[] {
  const names = cells(input, (document) => document.extracted?.fields.fullName ?? null);
  const ids = cells(input, (document) => document.extracted?.fields.idNumber ?? null);
  const stands = cells(
    input,
    (document) => (PROPERTY_TYPES.includes(document.declaredType) ? document.extracted?.fields.standNumber ?? null : null)
  );
  const suburbs = cells(
    input,
    (document) => (PROPERTY_TYPES.includes(document.declaredType) ? document.extracted?.fields.suburb ?? null : null)
  );
  return [
    {
      field: "Seller name",
      entered: input.seller.fullName,
      documents: names,
      consistent: names.every((cell) => compareNames(input.seller.fullName, cell.value) !== "mismatch"),
    },
    {
      field: "National ID",
      entered: input.seller.idNumber,
      documents: ids,
      consistent: ids.every((cell) => cell.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === input.seller.idNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase()),
    },
    {
      field: "Stand number",
      entered: input.property.standNumber,
      documents: stands,
      consistent: stands.every((cell) => compareStands(input.property.standNumber, cell.value) !== "mismatch"),
    },
    {
      field: "Suburb",
      entered: input.property.suburb,
      documents: suburbs,
      consistent: suburbs.every((cell) => comparePlaces(input.property.suburb, cell.value) !== "mismatch"),
    },
  ];
}

export function missingDocumentLabels(input: EvaluationInput): string[] {
  const present = new Set(input.documents.map((document) => document.declaredType));
  return requiredDocumentTypes(input)
    .filter((type) => !present.has(type))
    .map((type) => DOCUMENT_LABEL[type]);
}

export function buildRecommendations(
  input: EvaluationInput,
  checks: DueDiligenceCheck[],
  status: Evaluation["status"],
  _score: number
): string[] {
  const notes: string[] = [];
  const tenure = input.property.tenureType;
  if (tenure === "title_deed") {
    notes.push("Request an official Deeds Registry search through a conveyancer. This system cannot replace the Deeds Office.");
    notes.push("SI 76 of 2025 and the Digital Land Administration Platform (DLAP): older paper deeds may need validation against the registry before transfer.");
  }
  if (tenure === "council_cession") {
    notes.push("Confirm the cession with the local authority. An agreement on the file is not the same as the council's own record.");
  }
  if (tenure === "developer_cession") {
    notes.push("Keep the subdivision permit and development permit together. A later title still needs the Deeds Registry.");
  }
  if (checks.some((item) => item.code === "document_rates_clearance" && item.status === "fail")) {
    notes.push("A rates clearance certificate is required before transfer.");
  }
  if (checks.some((item) => item.code === "rates_expiry" && item.status === "fail")) {
    notes.push("Ask the local authority for a current rates clearance. The copy on the file has expired.");
  }
  const price = input.property.askingPriceUsd;
  if (status === "fail" || (price != null && price >= CONVEYANCER_REVIEW_PRICE_USD)) {
    notes.push("Arrange conveyancer review before marketing this property as cleared.");
  }
  if (input.seller.maritalStatus === "married") {
    notes.push("Ask whether spousal consent is needed for this transfer.");
  }
  notes.push("Record the reason if you override a check. The next run keeps that override until you revert it.");
  return notes;
}

export function buildSummary(sellerName: string, status: Evaluation["status"], score: number): string {
  if (status === "pass") {
    return `${sellerName}'s file scored ${score} of 100, which is a pass. You can record clearance. Transfer still goes through a conveyancer.`;
  }
  if (status === "conditional_pass") {
    return `${sellerName}'s file scored ${score} of 100, a conditional pass. 80 and above is a pass. Close the open items before treating the property as cleared.`;
  }
  return `${sellerName}'s file scored ${score} of 100, which is below 50 and fails. Do not market it as cleared until the failed items are resolved.`;
}

export function toChecklist(checks: DueDiligenceCheck[]): ChecklistItem[] {
  return checks.flatMap((item) => {
    if (item.status === "not_applicable") return [];
    const missing = item.code.startsWith("document_") && item.status !== "pass";
    const status: ChecklistItem["status"] = item.status === "pass" ? "pass" : missing ? "missing" : "fail";
    return [{ code: item.code, label: item.label, status, detail: item.detail }];
  });
}

export function collectRedFlags(input: EvaluationInput, reasons: string[]): string[] {
  const fromDocuments = input.documents.flatMap((document) => [
    ...(document.extracted?.redFlags ?? []),
    ...(Array.isArray(document.extracted?.fields.restrictions) ? document.extracted.fields.restrictions : []),
  ]);
  return [...new Set([...reasons, ...fromDocuments].map((item) => item.trim()).filter(Boolean))];
}

export function summarise(input: EvaluationInput, checks: DueDiligenceCheck[]): Omit<Evaluation, "checks" | "comparison"> & { comparison: ComparisonRow[] } {
  const { score, reasons } = scoreRisk(checks);
  const status = decideStatus(checks, score);
  const redFlags = collectRedFlags(input, reasons);
  return {
    score,
    reasons,
    status,
    summary: buildSummary(input.seller.fullName, status, score),
    recommendations: buildRecommendations(input, checks, status, score),
    missingDocuments: missingDocumentLabels(input),
    comparison: buildComparison(input),
    redFlags,
    checklist: toChecklist(checks),
  };
}
