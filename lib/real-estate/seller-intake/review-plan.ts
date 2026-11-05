import {
  categoryMapping,
  exclusivityNote,
  isCompanyOwner,
  mandateDates,
  moneyAmount,
  personName,
  registeredOwnerName,
  rightsMapping,
} from "@/lib/real-estate/seller-intake/fields";
import type { IntakeKind } from "@/lib/real-estate/seller-intake/fields";

export type IntakeSnapshot = {
  templateId: string;
  templateVersion: number;
  kind: IntakeKind;
  title: string;
  clauses: string[];
  organisationName?: string | null;
  exclusivityMinimumMonths: number | null;
  exclusivityContinuesUntilVaried: boolean;
  answers: Record<string, string>;
  submittedAt: string;
};

export type PreparedDocumentState = {
  signatureState: "prepared_unsigned" | "signed_uploaded" | "evidence_reviewed";
  scanStatus: string;
};

export function countsAsSignatureEvidence(document: PreparedDocumentState): boolean {
  return document.signatureState === "evidence_reviewed" && document.scanStatus === "clean";
}

export function initialDocumentScanStatus(): "unscanned" {
  return "unscanned";
}

export function signedUploadState(): PreparedDocumentState {
  return { signatureState: "signed_uploaded", scanStatus: "unscanned" };
}

export function recordDifferences(
  current: Record<string, string | null | undefined>,
  incoming: Record<string, string | null | undefined>
): Array<{ field: string; from: string; to: string }> {
  const fields = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  const changes = [];
  for (const field of fields) {
    const from = current[field]?.trim() || "";
    const to = incoming[field]?.trim() || "";
    if (!from || !to || from === to) continue;
    changes.push({ field, from, to });
  }
  return changes;
}

export type PartyDraft = {
  role: "registered_owner" | "representative" | "witness" | "negotiator";
  partyKind: "individual" | "company";
  contactId: string | null;
  displayName: string;
};

export function partyDrafts(input: {
  answers: Record<string, string>;
  personContactId: string | null;
  negotiatorName: string;
}): PartyDraft[] {
  const company = isCompanyOwner(input.answers);
  const parties: PartyDraft[] = [
    {
      role: "registered_owner",
      partyKind: company ? "company" : "individual",
      contactId: company ? null : input.personContactId,
      displayName: registeredOwnerName(input.answers),
    },
  ];
  if (company) {
    parties.push({
      role: "representative",
      partyKind: "individual",
      contactId: input.personContactId,
      displayName: personName(input.answers),
    });
  }
  if (input.negotiatorName.trim()) {
    parties.push({
      role: "negotiator",
      partyKind: "individual",
      contactId: null,
      displayName: input.negotiatorName.trim(),
    });
  }
  return parties;
}

export function intakeCommercialPlan(snapshot: IntakeSnapshot): {
  ownerName: string;
  personName: string;
  company: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  residentialAddress: string | null;
  categoryOriginal: string | null;
  categoryPlatform: string | null;
  categoryAmbiguous: string | null;
  rightsOriginal: string | null;
  legalRoute: "cession" | null;
  rightsAmbiguous: string | null;
  mandatePrice: number | null;
  askingPrice: number | null;
  startDate: string | null;
  expiryDate: string | null;
  exclusivity: string | null;
  signatureDate: null;
  createsListing: false;
  mandateStatus: "submitted";
  evidenceStatus: "not_provided";
  complianceStatus: "awaiting_documents";
} {
  const category = categoryMapping(snapshot.answers.propertyCategory);
  const rights = rightsMapping(snapshot.answers.propertyRights);
  const dates = mandateDates(snapshot.kind, snapshot.answers);
  return {
    ownerName: registeredOwnerName(snapshot.answers),
    personName: personName(snapshot.answers),
    company: isCompanyOwner(snapshot.answers),
    phone: snapshot.answers.cell || snapshot.answers.representativePhone || null,
    email: snapshot.answers.email || null,
    address: snapshot.answers.propertyAddress || null,
    residentialAddress: snapshot.answers.residentialAddress || null,
    categoryOriginal: category.original,
    categoryPlatform: category.platform,
    categoryAmbiguous: category.ambiguous,
    rightsOriginal: rights.original,
    legalRoute: rights.legalRoute,
    rightsAmbiguous: rights.ambiguous,
    mandatePrice: snapshot.kind === "open" ? moneyAmount(snapshot.answers.mandatePrice) : null,
    askingPrice: moneyAmount(snapshot.answers.askingPrice),
    startDate: dates.startDate,
    expiryDate: dates.expiryDate,
    exclusivity: exclusivityNote({
      kind: snapshot.kind,
      minimumMonths: snapshot.exclusivityMinimumMonths,
      continuesUntilVaried: snapshot.exclusivityContinuesUntilVaried,
    }),
    signatureDate: null,
    createsListing: false,
    mandateStatus: "submitted",
    evidenceStatus: "not_provided",
    complianceStatus: "awaiting_documents",
  };
}

export function complianceProfile(snapshot: IntakeSnapshot): Record<string, unknown> {
  const answers = snapshot.answers;
  return {
    verification: "unverified",
    registered_owner: registeredOwnerName(answers),
    owner_kind: isCompanyOwner(answers) ? "company" : "individual",
    representative_name: isCompanyOwner(answers) ? personName(answers) : null,
    identity_number: answers.identityNumber || null,
    representative_identity: answers.representativeIdentity || null,
    spouse_name: answers.spouseName || null,
    employer_name: answers.employerName || null,
    source_of_funds: answers.sourceOfFunds || null,
    pep: answers.pep || null,
    nationality: answers.nationality || null,
    shareholder_lines: answers.shareholderLines || null,
    property_category_original: answers.propertyCategory || null,
    property_rights_original: answers.propertyRights || null,
    title_reference: answers.titleReference || null,
  };
}

export function reviewCanFinish(input: { mandateId: string | null; documentId: string | null }): boolean {
  return Boolean(input.mandateId && input.documentId);
}
