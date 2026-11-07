import type { PropertyCategory } from "@/lib/real-estate/buyer-match";

export const INTAKE_GROUPS = [
  "parties",
  "property",
  "occupancy",
  "mandate_terms",
  "owner_identity",
  "company",
] as const;

export type IntakeGroup = (typeof INTAKE_GROUPS)[number];
export type IntakeKind = "open" | "sole";

export type IntakeField = {
  key: string;
  label: string;
  group: IntakeGroup;
  input: "text" | "textarea" | "date" | "choice" | "money";
  options?: readonly string[];
  requiredToSubmit: boolean;
  restricted: boolean;
};

export const OPEN_PROPERTY_CATEGORIES = [
  "Land",
  "House",
  "Cluster/Townhouse",
  "Industrial",
  "Commercial",
  "Farm",
  "Other",
] as const;

export const OPEN_PROPERTY_RIGHTS = ["Full Title", "Sectional Title", "Share Transfer", "Cession"] as const;

export const SELLER_TITLES = ["Mr", "Mrs", "Ms"] as const;

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;

export const WORK_INDUSTRIES = [
  "Agriculture",
  "Construction",
  "Education",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Mining",
  "Professional services",
  "Retail",
  "Transport",
  "Other",
] as const;

const openFields: IntakeField[] = [
  { key: "propertyAddress", label: "Property address", group: "property", input: "textarea", requiredToSubmit: true, restricted: false },
  { key: "registeredOwner", label: "Registered owner", group: "parties", input: "text", requiredToSubmit: true, restricted: false },
  { key: "propertyCategory", label: "Property category", group: "property", input: "choice", options: OPEN_PROPERTY_CATEGORIES, requiredToSubmit: false, restricted: false },
  { key: "propertyCategoryOther", label: "Other category", group: "property", input: "text", requiredToSubmit: false, restricted: false },
  { key: "propertyRights", label: "Property rights", group: "property", input: "choice", options: OPEN_PROPERTY_RIGHTS, requiredToSubmit: false, restricted: false },
  { key: "titleReference", label: "Title deed or share certificate number", group: "property", input: "text", requiredToSubmit: false, restricted: false },
  { key: "propertyDescription", label: "Property description", group: "property", input: "textarea", requiredToSubmit: false, restricted: false },
  { key: "occupation", label: "Occupation", group: "occupancy", input: "choice", options: ["Owner occupied", "Tenant occupied"], requiredToSubmit: false, restricted: false },
  { key: "occupantName", label: "Occupant name", group: "occupancy", input: "text", requiredToSubmit: false, restricted: false },
  { key: "occupantPhone", label: "Occupant cell", group: "occupancy", input: "text", requiredToSubmit: false, restricted: false },
  { key: "mandateStartDate", label: "Mandate start date", group: "mandate_terms", input: "date", requiredToSubmit: false, restricted: false },
  { key: "mandateEndDate", label: "Mandate end date", group: "mandate_terms", input: "date", requiredToSubmit: false, restricted: false },
  { key: "mandatePrice", label: "Mandate price", group: "mandate_terms", input: "money", requiredToSubmit: true, restricted: false },
  { key: "mandatePriceWords", label: "Mandate price in words", group: "mandate_terms", input: "text", requiredToSubmit: false, restricted: false },
  { key: "paymentMode", label: "Payment", group: "mandate_terms", input: "choice", options: ["Cash", "Electronic", "Other"], requiredToSubmit: false, restricted: false },
  { key: "paymentModeOther", label: "Other payment", group: "mandate_terms", input: "text", requiredToSubmit: false, restricted: false },
  { key: "askingPrice", label: "Asking price before commission", group: "mandate_terms", input: "money", requiredToSubmit: true, restricted: false },
  { key: "sellerTitle", label: "Title", group: "owner_identity", input: "choice", options: SELLER_TITLES, requiredToSubmit: false, restricted: true },
  { key: "surname", label: "Surname", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "givenName", label: "Name", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "nationality", label: "Nationality", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "identityNumber", label: "Identity number", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "maritalStatus", label: "Marital status", group: "owner_identity", input: "choice", options: MARITAL_STATUSES, requiredToSubmit: false, restricted: true },
  { key: "spouseName", label: "Spouse", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "occupationJob", label: "Occupation", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "industry", label: "Industry", group: "owner_identity", input: "choice", options: WORK_INDUSTRIES, requiredToSubmit: false, restricted: true },
  { key: "industryOther", label: "Other industry", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "position", label: "Position", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "cell", label: "Cell", group: "parties", input: "text", requiredToSubmit: false, restricted: false },
  { key: "employerName", label: "Employer", group: "owner_identity", input: "text", requiredToSubmit: false, restricted: true },
  { key: "email", label: "Email", group: "parties", input: "text", requiredToSubmit: false, restricted: false },
  { key: "residentialAddress", label: "Residential address", group: "parties", input: "textarea", requiredToSubmit: false, restricted: false },
  { key: "employerAddress", label: "Employer address", group: "owner_identity", input: "textarea", requiredToSubmit: false, restricted: true },
  { key: "sourceOfFunds", label: "Source of funds", group: "owner_identity", input: "textarea", requiredToSubmit: false, restricted: true },
  { key: "pep", label: "Politically exposed person", group: "owner_identity", input: "choice", options: ["Yes", "No"], requiredToSubmit: false, restricted: true },
  { key: "ownerKind", label: "Owner is", group: "company", input: "choice", options: ["Individual", "Company"], requiredToSubmit: false, restricted: false },
  { key: "companyName", label: "Company name", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "companyAddress", label: "Company address", group: "company", input: "textarea", requiredToSubmit: false, restricted: false },
  { key: "companyIndustry", label: "Company industry", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "companyEmail", label: "Company email", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "companyPhones", label: "Company telephone numbers", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "representativeName", label: "Representative name", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "representativeIdentity", label: "Representative identity number", group: "company", input: "text", requiredToSubmit: false, restricted: true },
  { key: "representativePosition", label: "Representative position", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "representativeAddress", label: "Representative address", group: "company", input: "textarea", requiredToSubmit: false, restricted: false },
  { key: "representativePhone", label: "Representative contact number", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "shareholderLines", label: "Shareholders of 10 percent or more", group: "company", input: "textarea", requiredToSubmit: false, restricted: true },
];

const soleFields: IntakeField[] = [
  { key: "propertyAddress", label: "Property address", group: "property", input: "textarea", requiredToSubmit: true, restricted: false },
  { key: "registeredOwner", label: "Registered owner", group: "parties", input: "text", requiredToSubmit: true, restricted: false },
  { key: "residentialAddress", label: "Owner residential address", group: "parties", input: "textarea", requiredToSubmit: false, restricted: false },
  { key: "cell", label: "Mobile", group: "parties", input: "text", requiredToSubmit: false, restricted: false },
  { key: "askingPrice", label: "Asking price before commission", group: "mandate_terms", input: "money", requiredToSubmit: true, restricted: false },
  { key: "ownerKind", label: "Owner is", group: "company", input: "choice", options: ["Individual", "Company"], requiredToSubmit: false, restricted: false },
  { key: "companyName", label: "Company name", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "representativeName", label: "Representative name", group: "company", input: "text", requiredToSubmit: false, restricted: false },
  { key: "representativePhone", label: "Representative contact number", group: "company", input: "text", requiredToSubmit: false, restricted: false },
];

const SCOPE_KEYS = new Set([
  "clientId",
  "client_id",
  "organisationId",
  "organizationId",
  "agentId",
  "responsibleAgentId",
  "contactId",
  "contact_id",
  "opportunityId",
  "opportunity_id",
  "documentId",
  "document_id",
  "templateId",
  "requestId",
  "signatureDate",
  "signedAt",
  "witnessSignature",
  "ownerSignature",
]);

export function fieldsForKind(kind: IntakeKind): IntakeField[] {
  return kind === "sole" ? soleFields : openFields;
}

export function answersFromClient(kind: IntakeKind, raw: unknown): Record<string, string> {
  const allowed = new Set(fieldsForKind(kind).map((field) => field.key));
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (SCOPE_KEYS.has(key) || !allowed.has(key)) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    answers[key] = String(value).trim().slice(0, 4000);
  }
  return answers;
}

export function submissionGaps(kind: IntakeKind, answers: Record<string, string>): string[] {
  const gaps = fieldsForKind(kind)
    .filter((field) => field.requiredToSubmit && !answers[field.key])
    .map((field) => field.label);
  if (answers.ownerKind === "Company") {
    if (!answers.companyName) gaps.push("Company name");
    if (!answers.representativeName) gaps.push("Representative name");
  }
  return gaps;
}

export function missingInformation(kind: IntakeKind, answers: Record<string, string>): string[] {
  const gaps = submissionGaps(kind, answers);
  for (const field of fieldsForKind(kind)) {
    if (!field.requiredToSubmit && field.restricted && !answers[field.key]) gaps.push(field.label);
  }
  return [...new Set(gaps)];
}

export function categoryMapping(label: string | null | undefined): {
  original: string | null;
  platform: PropertyCategory | null;
  ambiguous: string | null;
} {
  const original = label?.trim() || null;
  if (!original) return { original: null, platform: null, ambiguous: null };
  if (original === "House") return { original, platform: "house", ambiguous: null };
  if (original === "Industrial") return { original, platform: "industrial", ambiguous: null };
  if (original === "Commercial") return { original, platform: "commercial", ambiguous: null };
  if (original === "Farm") {
    return {
      original,
      platform: "agricultural",
      ambiguous: "The form says Farm. Agricultural is the closest platform category and still needs the reviewer to confirm it.",
    };
  }
  if (original === "Other") return { original, platform: "other", ambiguous: null };
  if (original === "Land") {
    return { original, platform: null, ambiguous: "Land is not recorded as a residential stand." };
  }
  if (original === "Cluster/Townhouse") {
    return { original, platform: null, ambiguous: "Cluster/Townhouse is not recorded as townhouse." };
  }
  return { original, platform: null, ambiguous: `No platform category matches ${original}.` };
}

export function rightsMapping(label: string | null | undefined): {
  original: string | null;
  legalRoute: "cession" | null;
  ambiguous: string | null;
} {
  const original = label?.trim() || null;
  if (!original) return { original: null, legalRoute: null, ambiguous: null };
  if (original === "Cession") return { original, legalRoute: "cession", ambiguous: null };
  return {
    original,
    legalRoute: null,
    ambiguous: `${original} is kept as written. It is not treated as the same right as the other choices.`,
  };
}

export function moneyAmount(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function isoDateOrNull(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  return raw;
}

export function mandateDates(kind: IntakeKind, answers: Record<string, string>): { startDate: string | null; expiryDate: string | null } {
  if (kind === "sole") return { startDate: null, expiryDate: null };
  return {
    startDate: isoDateOrNull(answers.mandateStartDate),
    expiryDate: isoDateOrNull(answers.mandateEndDate),
  };
}

export function exclusivityNote(input: {
  kind: IntakeKind;
  minimumMonths: number | null;
  continuesUntilVaried: boolean;
}): string | null {
  if (input.kind !== "sole") return null;
  if (!input.minimumMonths && !input.continuesUntilVaried) {
    return "This template does not state a minimum exclusive period or an end date. No expiry date was added.";
  }
  const minimum = input.minimumMonths
    ? `The template says a minimum of ${input.minimumMonths} months measured from the signature date.`
    : "The template does not state a minimum number of months.";
  const continuation = input.continuesUntilVaried
    ? " It then continues until the owner varies it in writing."
    : "";
  return `${minimum}${continuation} No signature date or expiry date was invented.`;
}

export function mergeCorrection(
  previous: Record<string, string>,
  incoming: Record<string, string>,
  acceptedGroups: readonly string[]
): Record<string, string> {
  const locked = new Set(acceptedGroups);
  const next = { ...incoming };
  for (const field of [...openFields, ...soleFields]) {
    if (!locked.has(field.group)) continue;
    if (previous[field.key]) next[field.key] = previous[field.key];
    else delete next[field.key];
  }
  return next;
}

export function isCompanyOwner(answers: Record<string, string>): boolean {
  return answers.ownerKind === "Company" || Boolean(answers.companyName && answers.representativeName);
}

export function personName(answers: Record<string, string>): string {
  if (isCompanyOwner(answers)) return answers.representativeName || answers.registeredOwner || "Representative";
  return [answers.givenName, answers.surname].filter(Boolean).join(" ") || answers.registeredOwner || "Property owner";
}

export function registeredOwnerName(answers: Record<string, string>): string {
  if (isCompanyOwner(answers)) return answers.companyName || answers.registeredOwner || "Company owner";
  return answers.registeredOwner || personName(answers);
}
