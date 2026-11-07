import { isCompany, isFieldVisible } from "@/lib/real-estate/seller-intake/client-form";
import { fieldsForKind, type IntakeKind } from "@/lib/real-estate/seller-intake/fields";

const HIDDEN = "Submitted for a permitted reviewer";

type Spec = {
  key: string;
  label: string;
  companyLabel?: string;
  fields: readonly string[];
};

const SPECS: readonly Spec[] = [
  { key: "owner", label: "Registered owner", fields: ["registeredOwner"] },
  { key: "name", label: "Name", companyLabel: "Representative's name", fields: ["sellerTitle", "givenName", "surname"] },
  { key: "nationality", label: "Nationality", companyLabel: "Representative's nationality", fields: ["nationality"] },
  { key: "identity", label: "Identity number", companyLabel: "Representative's identity number", fields: ["identityNumber"] },
  { key: "marital", label: "Marital status", fields: ["maritalStatus"] },
  { key: "spouse", label: "Spouse", fields: ["spouseName"] },
  { key: "phone", label: "Mobile number", fields: ["cell"] },
  { key: "home", label: "Residential address", companyLabel: "Representative's residential address", fields: ["residentialAddress"] },
  { key: "work", label: "Occupation and industry", fields: ["occupationJob", "industry"] },
  { key: "industry_other", label: "Industry description", fields: ["industryOther"] },
  { key: "role", label: "Job title", fields: ["position"] },
  { key: "employer", label: "Employer", fields: ["employerName"] },
  { key: "employer_address", label: "Employer address", fields: ["employerAddress"] },
  { key: "funds", label: "Source of funds", fields: ["sourceOfFunds"] },
  { key: "pep", label: "PEP declaration", fields: ["pep"] },
  { key: "company", label: "Registered company name", fields: ["companyName"] },
  { key: "company_address", label: "Company address", fields: ["companyAddress"] },
  { key: "company_activity", label: "What the company does", fields: ["companyIndustry"] },
  { key: "representative", label: "Person who completed the form", fields: ["representativeName"] },
  { key: "representative_role", label: "Representative's role", fields: ["representativePosition"] },
  { key: "shareholders", label: "Shareholders of 10 percent or more", fields: ["shareholderLines"] },
  { key: "property", label: "Property address", fields: ["propertyAddress"] },
  { key: "category", label: "Property type", fields: ["propertyCategory"] },
  { key: "rights", label: "How ownership is recorded", fields: ["propertyRights"] },
  { key: "title_ref", label: "Title reference", fields: ["titleReference"] },
  { key: "asking", label: "Asking price", fields: ["askingPrice"] },
  { key: "mandate_price", label: "Mandate price", fields: ["mandatePrice"] },
  { key: "dates", label: "Mandate dates", fields: ["mandateStartDate", "mandateEndDate"] },
];

const INDIVIDUAL_NOT_ON_FORM = [
  "Date of birth",
  "A copy of the identity document",
  "Proof of the residential address",
];

const COMPANY_NOT_ON_FORM = [
  "Company registration number",
  "Company registration documents",
  "Directors recorded as separate people",
  "Proof the representative may sign",
];

export type MandateCheckStatus = "recorded" | "missing" | "attention";

export type MandateCheck = {
  key: string;
  label: string;
  status: MandateCheckStatus;
  detail: string;
};

export type MandateComplianceReport = {
  summary: string;
  recorded: MandateCheck[];
  missing: MandateCheck[];
  attention: MandateCheck[];
  notOnForm: string[];
};

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

export function evaluateMandateCompliance(kind: IntakeKind, answers: Record<string, string>): MandateComplianceReport {
  const present = new Set(fieldsForKind(kind).map((field) => field.key));
  const company = isCompany(answers);
  const recorded: MandateCheck[] = [];
  const missing: MandateCheck[] = [];
  const attention: MandateCheck[] = [];

  for (const spec of SPECS) {
    const active = spec.fields.filter((key) => present.has(key) && isFieldVisible(key, answers, present));
    if (active.length === 0) continue;
    const values = active.map((key) => ({ key, value: answers[key]?.trim() ?? "" }));
    const label = company && spec.companyLabel ? spec.companyLabel : spec.label;
    const blank = values.some((item) => !item.value);
    if (blank) {
      missing.push({ key: spec.key, label, status: "missing", detail: "Not answered on the form" });
      continue;
    }
    const hidden = values.every((item) => item.value === HIDDEN);
    const shown = values.filter((item) => item.value !== HIDDEN).map((item) => item.value);
    if (spec.key === "pep" && shown.some((value) => value.toLowerCase() === "yes")) {
      attention.push({ key: spec.key, label, status: "attention", detail: "Answered Yes. A reviewer needs to look at this before the file is treated as clear." });
      continue;
    }
    recorded.push({
      key: spec.key,
      label,
      status: "recorded",
      detail: hidden ? "Recorded on the form" : clip(shown.join(" · ")),
    });
  }

  const good = recorded.length === 1 ? "1 check is on the form." : `${recorded.length} checks are on the form.`;
  const blank = missing.length === 0 ? "" : missing.length === 1 ? " 1 answer is still blank." : ` ${missing.length} answers are still blank.`;
  const review = attention.length === 0 ? "" : attention.length === 1 ? " 1 answer needs a reviewer." : ` ${attention.length} answers need a reviewer.`;

  return {
    summary: `${good}${blank}${review}`,
    recorded,
    missing,
    attention,
    notOnForm: company ? COMPANY_NOT_ON_FORM : INDIVIDUAL_NOT_ON_FORM,
  };
}
