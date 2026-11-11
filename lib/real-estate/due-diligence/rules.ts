import { compareIds, compareNames, comparePlaces, compareStands } from "@/lib/real-estate/due-diligence/compare";
import {
  DOCUMENT_LABEL,
  type DocumentExtraction,
  type DocumentInput,
  type DocumentType,
  type DueDiligenceCheck,
  type EvaluationInput,
  type TenureType,
} from "@/lib/real-estate/due-diligence/types";

const PROPERTY_DOCUMENTS: DocumentType[] = [
  "title_deed",
  "cession_agreement",
  "agreement_of_sale",
  "subdivision_permit",
  "development_permit",
  "certificate_of_compliance",
];

function check(
  partial: Omit<DueDiligenceCheck, "evidence"> & { evidence?: Record<string, unknown> }
): DueDiligenceCheck {
  return { ...partial, evidence: partial.evidence ?? {} };
}

function hasDeclared(documents: DocumentInput[], type: DocumentType): boolean {
  return documents.some((document) => document.declaredType === type);
}

function namesOn(extraction: DocumentExtraction | null): string[] {
  if (!extraction) return [];
  return [extraction.fields.fullName, ...extraction.fields.otherNames].filter((value): value is string => Boolean(value));
}

function collected<T>(documents: DocumentInput[], read: (document: DocumentInput) => T | null): T[] {
  return documents.flatMap((document) => {
    const value = read(document);
    return value == null ? [] : [value];
  });
}

/**
 * Documents an agent should attach before the check is worth running.
 * Utility clearance and the selfie stay optional: they help, they do not block marketing.
 */
export function requiredDocumentTypes(input: Pick<EvaluationInput, "seller" | "property">): DocumentType[] {
  const tenure = input.property.tenureType;
  const required: DocumentType[] = ["national_id"];
  if (tenure === "title_deed") required.push("title_deed", "rates_clearance");
  if (tenure === "council_cession") required.push("agreement_of_sale");
  if (tenure === "developer_cession") required.push("subdivision_permit", "development_permit");
  if (input.seller.sellerKind === "company") required.push("company_resolution");
  if (input.seller.actingCapacity === "representative") required.push("power_of_attorney");
  return required;
}

export function suggestedUploads(tenure: TenureType): DocumentType[] {
  if (tenure === "title_deed") {
    return ["national_id", "title_deed", "rates_clearance", "survey_diagram", "utility_clearance", "selfie"];
  }
  if (tenure === "council_cession") {
    return ["national_id", "agreement_of_sale", "cession_agreement", "rates_clearance", "utility_clearance", "selfie"];
  }
  return [
    "national_id",
    "subdivision_permit",
    "development_permit",
    "certificate_of_compliance",
    "cession_agreement",
    "rates_clearance",
    "selfie",
  ];
}

function documentPresence(input: EvaluationInput): DueDiligenceCheck[] {
  const required = requiredDocumentTypes(input);
  const checks = required.map((type) => {
    const present = hasDeclared(input.documents, type);
    return check({
      code: `document_${type}`,
      label: DOCUMENT_LABEL[type],
      status: present ? "pass" : "fail",
      critical: true,
      weight: 55,
      detail: present
        ? `${DOCUMENT_LABEL[type]} is on the file.`
        : `${DOCUMENT_LABEL[type]} is missing. The checklist for this tenure treats it as required.`,
      evidence: { documentType: type },
    });
  });
  if (input.property.tenureType === "title_deed") {
    const present = hasDeclared(input.documents, "survey_diagram");
    checks.push(check({
      code: "survey_diagram",
      label: "Surveyor General diagram",
      status: present ? "pass" : "warning",
      critical: false,
      weight: 12,
      detail: present
        ? "A Surveyor General diagram is on the file."
        : "No Surveyor General diagram is on the file. Ask the conveyancer whether the deed's diagram number is enough.",
    }));
  }
  if (input.property.tenureType === "council_cession" || input.property.tenureType === "developer_cession") {
    const present = hasDeclared(input.documents, "rates_clearance");
    checks.push(check({
      code: "document_rates_clearance",
      label: DOCUMENT_LABEL.rates_clearance,
      status: present ? "pass" : "warning",
      critical: false,
      weight: 15,
      detail: present
        ? "Rates clearance is on the file."
        : "Rates clearance is not on the file. It is still required before transfer.",
      evidence: { documentType: "rates_clearance" },
    }));
  }
  return checks;
}

function identityChecks(input: EvaluationInput): DueDiligenceCheck[] {
  const idDocs = input.documents.filter((document) => document.declaredType === "national_id" || document.extracted?.documentType === "national_id");
  const propertyDocs = input.documents.filter((document) => PROPERTY_DOCUMENTS.includes(document.declaredType));
  const entered = input.seller.fullName;
  const compared = propertyDocs.flatMap((document) => namesOn(document.extracted).map((name) => ({ name, fileName: document.fileName })));
  const idNames = idDocs.flatMap((document) => namesOn(document.extracted).map((name) => ({ name, fileName: document.fileName })));
  const targets = [...idNames, ...compared];

  let name: DueDiligenceCheck;
  if (targets.length === 0) {
    name = check({
      code: "identity_name_match",
      label: "Name match",
      status: "warning",
      critical: false,
      weight: 8,
      detail: "No name could be read from the identity or property documents. Compare them yourself before clearance.",
    });
  } else {
    const mismatches = targets.filter((target) => compareNames(entered, target.name) === "mismatch");
    const matches = targets.filter((target) => compareNames(entered, target.name) === "match");
    if (mismatches.length > 0) {
      name = check({
        code: "identity_name_match",
        label: "Name match",
        status: "fail",
        critical: true,
        weight: 55,
        detail: `The name on the form does not match a name read from ${mismatches.map((item) => item.fileName).join(", ")}.`,
        evidence: { entered, mismatches: mismatches.map((item) => item.name) },
      });
    } else if (matches.length === 0) {
      name = check({
        code: "identity_name_match",
        label: "Name match",
        status: "warning",
        critical: false,
        weight: 8,
        detail: "A name was read, but there was not enough of it to compare with the seller.",
      });
    } else {
      name = check({
        code: "identity_name_match",
        label: "Name match",
        status: "pass",
        critical: true,
        weight: 30,
        detail: "The seller's name matches the name read from the documents. Order of names is ignored.",
        evidence: { entered, matched: matches.map((item) => item.name) },
      });
    }
  }

  const idNumbers = collected(input.documents, (document) => document.extracted?.fields.idNumber ?? null);
  const idComparisons = idNumbers.map((value) => compareIds(input.seller.idNumber, value));
  let idNumber: DueDiligenceCheck;
  if (idComparisons.includes("mismatch")) {
    idNumber = check({
      code: "identity_number_match",
      label: "ID number match",
      status: "fail",
      critical: true,
      weight: 55,
      detail: "An ID number read from a document does not match the number on the form.",
      evidence: { entered: input.seller.idNumber, read: idNumbers },
    });
  } else if (idComparisons.includes("match")) {
    idNumber = check({
      code: "identity_number_match",
      label: "ID number match",
      status: "pass",
      critical: true,
      weight: 25,
      detail: "The national ID number matches a number read from the documents.",
    });
  } else {
    idNumber = check({
      code: "identity_number_match",
      label: "ID number match",
      status: "warning",
      critical: false,
      weight: 8,
      detail: "No ID number could be read from the documents. Confirm the number on the original ID.",
    });
  }

  const identity = input.identity;
  const identityEvidence = {
    reference: identity?.reference ?? null,
    returnedName: identity?.returnedName ?? null,
    decision: identity?.decision ?? null,
    confidence: identity?.confidence ?? null,
    faceMatch: identity?.faceMatch ?? null,
    liveness: identity?.liveness ?? null,
  };
  let provider: DueDiligenceCheck;
  if (!identity || identity.status === "not_configured") {
    provider = check({
      code: "identity_verification",
      label: "Identity verification",
      status: "warning",
      critical: false,
      weight: 10,
      detail: identity?.detail || "Smile ID is not configured. The national ID was not checked.",
      evidence: identityEvidence,
    });
  } else if (identity.decision === "fail" || identity.status === "mismatch") {
    provider = check({
      code: "identity_verification",
      label: "Identity verification",
      status: "fail",
      critical: true,
      weight: 55,
      detail: identity.detail,
      evidence: identityEvidence,
    });
  } else if (identity.decision === "clear" || (identity.status === "verified" && !identity.decision)) {
    provider = check({
      code: "identity_verification",
      label: "Identity verification",
      status: "pass",
      critical: true,
      weight: 25,
      detail: identity.detail,
      evidence: identityEvidence,
    });
  } else {
    provider = check({
      code: "identity_verification",
      label: "Identity verification",
      status: "warning",
      critical: false,
      weight: identity.decision === "review" ? 25 : 10,
      detail: identity.detail,
      evidence: identityEvidence,
    });
  }

  return [name, idNumber, provider];
}

function propertyChecks(input: EvaluationInput): DueDiligenceCheck[] {
  const sources = input.documents.filter((document) => PROPERTY_DOCUMENTS.includes(document.declaredType) && document.extracted);
  const stands = sources.flatMap((document) => {
    const stand = document.extracted?.fields.standNumber;
    return stand ? [{ stand, fileName: document.fileName }] : [];
  });
  let stand: DueDiligenceCheck;
  if (stands.length === 0) {
    stand = check({
      code: "property_stand_match",
      label: "Stand number",
      status: sources.length > 0 ? "warning" : "not_applicable",
      critical: false,
      weight: 10,
      detail: sources.length > 0
        ? "A property document is on the file, but no stand number could be read from it."
        : "No property document was available to compare the stand number.",
    });
  } else if (stands.some((item) => compareStands(input.property.standNumber, item.stand) === "mismatch")) {
    stand = check({
      code: "property_stand_match",
      label: "Stand number",
      status: "fail",
      critical: true,
      weight: 55,
      detail: `The stand number on the form does not match a stand read from ${stands.map((item) => item.fileName).join(", ")}.`,
      evidence: { entered: input.property.standNumber, read: stands.map((item) => item.stand) },
    });
  } else {
    stand = check({
      code: "property_stand_match",
      label: "Stand number",
      status: "pass",
      critical: true,
      weight: 25,
      detail: "The stand number matches the number read from the property documents.",
    });
  }

  const suburbs = sources.flatMap((document) => {
    const suburb = document.extracted?.fields.suburb;
    return suburb ? [suburb] : [];
  });
  const suburbMismatch = suburbs.some((suburb) => comparePlaces(input.property.suburb, suburb) === "mismatch");
  const suburb: DueDiligenceCheck = check({
    code: "property_suburb_match",
    label: "Suburb",
    status: suburbs.length === 0 ? "not_applicable" : suburbMismatch ? "warning" : "pass",
    critical: false,
    weight: 8,
    detail: suburbs.length === 0
      ? "No suburb was read from the property documents."
      : suburbMismatch
        ? "The suburb on the form differs from a suburb read on a document. Spelling variants are common; confirm the stand."
        : "The suburb matches the property documents.",
    evidence: { entered: input.property.suburb, read: suburbs },
  });

  return [stand, suburb];
}

function qualityChecks(input: EvaluationInput): DueDiligenceCheck[] {
  const extracted = input.documents.flatMap((document) => (document.extracted ? [document.extracted] : []));
  if (extracted.length === 0) {
    return [check({
      code: "document_quality",
      label: "Document quality",
      status: "warning",
      critical: false,
      weight: 8,
      detail: "Documents were not read by the model. Completeness was checked from the types the agent selected.",
    })];
  }
  const suspicious = input.documents.filter((document) => document.extracted?.quality === "suspicious");
  const poor = input.documents.filter((document) => document.extracted?.quality === "poor");
  if (suspicious.length > 0) {
    return [check({
      code: "document_quality",
      label: "Document quality",
      status: "fail",
      critical: true,
      weight: 55,
      detail: `The model flagged ${suspicious.map((document) => document.fileName).join(", ")} as suspicious. Do not rely on that image.`,
      evidence: { notes: suspicious.map((document) => document.extracted?.qualityNotes) },
    })];
  }
  if (poor.length > 0) {
    return [check({
      code: "document_quality",
      label: "Document quality",
      status: "warning",
      critical: false,
      weight: 8,
      detail: `${poor.map((document) => document.fileName).join(", ")} ${poor.length === 1 ? "was" : "were"} hard to read. Ask for a clearer copy.`,
    })];
  }
  const disagreements = input.documents.filter((document) => {
    const extraction = document.extracted;
    if (!extraction || extraction.documentType === "unknown") return false;
    if (document.declaredType === "other" || document.declaredType === "selfie") return false;
    return extraction.confidence >= 0.75 && extraction.documentType !== document.declaredType;
  });
  const quality = check({
    code: "document_quality",
    label: "Document quality",
    status: "pass",
    critical: true,
    weight: 20,
    detail: "The model could read the uploaded documents and did not flag the image quality.",
  });
  if (disagreements.length === 0) return [quality];
  return [
    quality,
    check({
      code: "document_classification",
      label: "Document type",
      status: "warning",
      critical: false,
      weight: 8,
      detail: disagreements
        .map((document) => `${document.fileName} was filed as ${DOCUMENT_LABEL[document.declaredType]} but reads more like ${DOCUMENT_LABEL[document.extracted!.documentType as DocumentType]}.`)
        .join(" "),
    }),
  ];
}

function registryCheck(tenure: TenureType): DueDiligenceCheck {
  if (tenure === "title_deed") {
    return check({
      code: "deeds_registry_search",
      label: "Deeds Registry search",
      status: "warning",
      critical: false,
      weight: 25,
      detail: "No Deeds Registry search is on the file. Record one after a conveyancer confirms it. This system cannot query the Deeds Office.",
    });
  }
  if (tenure === "council_cession") {
    return check({
      code: "council_verification",
      label: "Council verification",
      status: "warning",
      critical: false,
      weight: 25,
      detail: "No council verification note is on the file. Confirm the cession with the local authority before treating it as cleared.",
    });
  }
  return check({
    code: "developer_authority",
    label: "Developer authority",
    status: "not_applicable",
    critical: false,
    weight: 0,
    detail: "Developer cessions are checked from the permits on the file. A later transfer into a title deed still needs the Deeds Registry.",
  });
}

function sellerSituation(input: EvaluationInput): DueDiligenceCheck[] {
  const married = input.seller.maritalStatus === "married"
    ? check({
      code: "spousal_consent",
      label: "Spousal consent",
      status: "warning",
      critical: false,
      weight: 10,
      detail: "The seller is recorded as married. Confirm whether spousal consent is required before transfer. This is a prompt, not a legal conclusion.",
    })
    : check({
      code: "spousal_consent",
      label: "Spousal consent",
      status: "not_applicable",
      critical: false,
      weight: 0,
      detail: "The seller is not recorded as married.",
    });
  return [married];
}

function listedRestrictions(document: DocumentInput): string[] {
  const value = document.extracted?.fields.restrictions;
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function ratesExpiry(input: EvaluationInput, today = new Date().toISOString().slice(0, 10)): DueDiligenceCheck {
  const certificates = input.documents.filter((document) => document.declaredType === "rates_clearance");
  if (certificates.length === 0) {
    return check({
      code: "rates_expiry",
      label: "Rates clearance expiry",
      status: "not_applicable",
      critical: false,
      weight: 0,
      detail: "There is no rates clearance to check for expiry.",
    });
  }
  const dated = certificates.flatMap((document) => {
    const expiry = document.extracted?.fields.expiryDate;
    return expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? [{ expiry, fileName: document.fileName }] : [];
  });
  const expired = dated.filter((item) => item.expiry < today);
  if (expired.length > 0) {
    return check({
      code: "rates_expiry",
      label: "Rates clearance expiry",
      status: "fail",
      critical: true,
      weight: 55,
      detail: `Rates clearance on ${expired.map((item) => item.fileName).join(", ")} expired on ${expired.map((item) => item.expiry).join(", ")}.`,
      evidence: { expired },
    });
  }
  if (dated.length === 0) {
    return check({
      code: "rates_expiry",
      label: "Rates clearance expiry",
      status: "warning",
      critical: false,
      weight: 10,
      detail: "A rates clearance is on the file, but no expiry date could be read. Confirm it is still valid.",
    });
  }
  return check({
    code: "rates_expiry",
    label: "Rates clearance expiry",
    status: "pass",
    critical: true,
    weight: 55,
    detail: `Rates clearance is dated in force until ${dated.map((item) => item.expiry).join(", ")}.`,
  });
}

function restrictionCheck(input: EvaluationInput): DueDiligenceCheck {
  const found = input.documents.flatMap((document) => listedRestrictions(document).map((text) => ({ text, fileName: document.fileName })));
  if (found.length === 0) {
    return check({
      code: "restrictions",
      label: "Caveats, bonds, and restrictions",
      status: input.documents.some((document) => document.extracted) ? "pass" : "not_applicable",
      critical: false,
      weight: 30,
      detail: input.documents.some((document) => document.extracted)
        ? "No caveat, bond, or other restriction was read on the documents."
        : "Restrictions can be checked once the documents have been read.",
    });
  }
  return check({
    code: "restrictions",
    label: "Caveats, bonds, and restrictions",
    status: "warning",
    critical: false,
    weight: 30,
    detail: `A restriction was read: ${found.map((item) => `${item.text} (${item.fileName})`).join("; ")}.`,
    evidence: { restrictions: found },
  });
}

/** Builds the checklist for one mandate. Human overrides are applied later by the service. */
export function buildChecks(input: EvaluationInput): DueDiligenceCheck[] {
  return [
    ...documentPresence(input),
    ...identityChecks(input),
    ...propertyChecks(input),
    ...qualityChecks(input),
    registryCheck(input.property.tenureType),
    ratesExpiry(input),
    restrictionCheck(input),
    ...sellerSituation(input),
  ];
}
