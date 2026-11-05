import { fieldsForKind, isoDateOrNull, type IntakeKind } from "@/lib/real-estate/seller-intake/fields";

export const SAVE_FAILURE = "We couldn't save your latest changes. Please try again before leaving this page.";

export type SectionId = "ownership" | "property" | "details" | "checks" | "instructions" | "review";

export type ClientField = {
  key: string;
  input: "text" | "textarea" | "date" | "choice" | "money";
  options?: readonly string[];
  requiredToSubmit: boolean;
  value: string;
  locked: boolean;
  instruction: string | null;
};

const SECTION_FIELDS: Record<Exclude<SectionId, "review">, readonly string[]> = {
  ownership: ["ownerKind", "registeredOwner"],
  property: ["propertyAddress", "propertyCategory", "propertyCategoryOther", "propertyRights", "titleReference", "propertyDescription", "occupation", "occupantName", "occupantPhone"],
  details: ["sellerTitle", "givenName", "surname", "nationality", "identityNumber", "maritalStatus", "spouseName", "cell", "email", "residentialAddress", "companyName", "companyAddress", "companyIndustry", "companyEmail", "companyPhones", "representativeName", "representativeIdentity", "representativePosition", "representativeAddress", "representativePhone", "shareholderLines"],
  checks: ["occupationJob", "industry", "position", "employerName", "employerAddress", "sourceOfFunds", "pep"],
  instructions: ["mandateStartDate", "mandateEndDate", "mandatePrice", "mandatePriceWords", "paymentMode", "paymentModeOther", "askingPrice"],
};

const COMPANY_KEYS = new Set(["companyName", "companyAddress", "companyIndustry", "companyEmail", "companyPhones", "representativeName", "representativeIdentity", "representativePosition", "representativeAddress", "representativePhone", "shareholderLines"]);
const SAME_PERSON: Record<string, string> = { representativeIdentity: "identityNumber", representativeAddress: "residentialAddress", representativePhone: "cell" };

const COPY: Record<string, { label: string; help: string; companyLabel?: string; companyHelp?: string }> = {
  ownerKind: { label: "Who owns the property?", help: "Choose whether the registered owner is an individual or a company." },
  registeredOwner: { label: "Whose name is the property registered in?", help: "Use the full name of the person or company shown on the ownership documents." },
  propertyAddress: { label: "Where is the property located?", help: "Include the stand or house number, street, suburb and town or city where available." },
  propertyCategory: { label: "What type of property are you selling?", help: "Choose the option that best describes the property." },
  propertyCategoryOther: { label: "How would you describe the property type?", help: "Use this only when the type is Other." },
  propertyRights: { label: "How is ownership recorded?", help: "Check your ownership documents. If you are unsure which option applies, ask your agent before choosing." },
  titleReference: { label: "Title deed or share certificate reference", help: "Use the reference on the relevant document. If you do not have it handy, you can save this draft." },
  propertyDescription: { label: "Tell us a little about the property", help: "Describe its condition, layout or features you would like your agent to know about." },
  occupation: { label: "Who currently occupies the property?", help: "This is about who lives at the property, not the owner's job." },
  occupantName: { label: "Occupant's full name", help: "This person may be different from the owner. Do not assume the representative lives here." },
  occupantPhone: { label: "Occupant's mobile number", help: "Include the country code where available." },
  sellerTitle: { label: "Title", help: "Use the title you want recorded with your name.", companyLabel: "Representative's title", companyHelp: "The title of the person completing this form for the company." },
  surname: { label: "Last name / surname", help: "As shown on the identity document requested by the agency.", companyLabel: "Representative's last name / surname" },
  givenName: { label: "First name(s)", help: "Include all first names where applicable.", companyLabel: "Representative's first name(s)" },
  nationality: { label: "Nationality", help: "Use the nationality recorded on your identity document.", companyLabel: "Representative's nationality" },
  identityNumber: { label: "Identity document number", help: "Enter the number from the identity document requested by your agency.", companyLabel: "Representative's identity document number" },
  maritalStatus: { label: "Marital status", help: "This forms part of the agency's personal-information section.", companyLabel: "Representative's marital status" },
  spouseName: { label: "Spouse's full name", help: "Shown because the marital status you entered asks for a spouse.", companyLabel: "Representative's spouse's full name" },
  cell: { label: "Your mobile number", help: "Include your country code, for example +263.", companyLabel: "Representative's mobile number", companyHelp: "The number on which the person completing this form can be contacted." },
  email: { label: "Email address", help: "Optional unless your agency has asked for it. This form does not send a copy by email." },
  residentialAddress: { label: "Where do you currently live?", help: "This is a residential address. It may be different from the property being sold.", companyLabel: "Representative's residential address", companyHelp: "Keep this separate from the company address and the property being sold." },
  occupationJob: { label: "What kind of work do you do?", help: "Your occupation, profession or type of business.", companyLabel: "What kind of work does the representative do?" },
  industry: { label: "What industry do you work in?", help: "For example, education, retail, construction or agriculture." },
  position: { label: "Job title or role", help: "For example, teacher, business owner or sales manager." },
  employerName: { label: "Employer or business name", help: "Complete the work details that apply. This is separate from the company that owns the property." },
  employerAddress: { label: "Employer or business address", help: "Keep this separate from your home and the property address." },
  sourceOfFunds: { label: "Source of funds", help: "This asks for the source of funds named in your agency's mandate. Ask your agent which funds they need described before you answer. Leaving this blank is not an answer of No." },
  pep: { label: "Politically exposed person (PEP) declaration", help: "Answer Yes or No for the person this section is about. If you are unsure, ask your agent before choosing. Leaving this blank is not a No." },
  companyName: { label: "Registered company name", help: "Use the company's full registered name. This stays separate from the name on the ownership documents unless they are the same." },
  companyAddress: { label: "Company address", help: "Keep this separate from the representative's home address." },
  companyIndustry: { label: "What does the company do?", help: "Describe its industry or main business activity." },
  companyEmail: { label: "Company email address", help: "Optional. This form does not send a copy by email." },
  companyPhones: { label: "Company contact number(s)", help: "Include country codes." },
  representativeName: { label: "Who is completing this for the company?", help: "Enter that person's full name. Completing the form does not by itself prove authority to sign." },
  representativeIdentity: { label: "Representative's identity document number", help: "Use the document requested by the agency." },
  representativePosition: { label: "Your role in the company", help: "For example, director or authorised representative. This answer does not itself verify authority." },
  representativeAddress: { label: "Representative's residential address", help: "Keep this separate from the company address." },
  representativePhone: { label: "Representative's mobile number", help: "Use the number on which the representative can be contacted." },
  shareholderLines: { label: "Shareholders with 10% ownership or more", help: "List each person who holds at least 10% on a separate line." },
  mandateStartDate: { label: "When should this mandate start?", help: "Choose a date. It will be shown as a day, month and year." },
  mandateEndDate: { label: "When should this mandate end?", help: "Use this only for a mandate that has an end date. A sole mandate that continues is not given an invented end date." },
  mandatePrice: { label: "Mandate price", help: "Enter the amount to be recorded as the mandate price. Ask your agent if you are unsure how it differs from the asking price below." },
  mandatePriceWords: { label: "Mandate price in words", help: "You can fill this from the amount if the words are still empty. An answer you already typed is kept." },
  paymentMode: { label: "How would you prefer payment to be made?", help: "This records a preference. It is not a confirmed payment." },
  paymentModeOther: { label: "Tell us your preferred payment method", help: "Shown because you chose Other." },
  askingPrice: { label: "What is your asking price before commission?", help: "Enter the total asking price before the agency's commission is deducted. This is separate from the mandate price and is not a published listing price." },
};

const SECTION_COPY: Record<SectionId, { title: string; intro: string }> = {
  ownership: { title: "Ownership", intro: "Say who the registered owner is. The person completing this form is not automatically the owner." },
  property: { title: "The property", intro: "Tell your agent where the property is, how it is described, and who occupies it now." },
  details: { title: "Your details", intro: "Add the contact details this mandate asks for." },
  checks: { title: "Work and agency checks", intro: "These are the work details and declarations on this mandate. Ask your agent if a question is unclear." },
  instructions: { title: "Selling instructions", intro: "Record the prices, payment preference and any mandate dates separately." },
  review: { title: "Check your details before sending", intro: "Review the owner, property and selling instructions below. You can return to any section to make changes." },
};

export const PEP_EXPLANATION = "A politically exposed person is someone who holds, or has held, a prominent public role. This question is only the Yes or No already on the form. It does not also answer for a family member or a close associate. If you are unsure, ask your agent. Leaving it blank is not recorded as No.";

export function isCompany(answers: Record<string, string>): boolean {
  return answers.ownerKind === "Company";
}

export function spouseRelevant(status: string | undefined): boolean {
  const value = status?.trim().toLowerCase() ?? "";
  if (!value) return false;
  if (/\b(single|divorced|widowed|unmarried|separated)\b/.test(value)) return false;
  return /\b(married|spouse|civil|partner)\b/.test(value);
}

export function isFieldVisible(key: string, answers: Record<string, string>, present?: ReadonlySet<string>): boolean {
  if (COMPANY_KEYS.has(key) && !isCompany(answers)) return false;
  const source = SAME_PERSON[key];
  if (source && isCompany(answers) && (!present || present.has(source))) {
    const hidden = answers[key]?.trim() ?? "";
    const shown = answers[source]?.trim() ?? "";
    if (!hidden || hidden === shown) return false;
  }
  if (key === "propertyCategoryOther" && answers.propertyCategory !== "Other") return false;
  if (key === "paymentModeOther" && answers.paymentMode !== "Other") return false;
  if (key === "spouseName" && !spouseRelevant(answers.maritalStatus)) return false;
  if ((key === "occupantName" || key === "occupantPhone") && answers.occupation !== "Tenant occupied" && answers.occupation !== "Owner occupied") return false;
  return true;
}

export function fieldCopy(key: string, answers: Record<string, string>): { label: string; help: string } {
  const copy = COPY[key] ?? { label: key, help: "" };
  if (isCompany(answers) && copy.companyLabel) {
    return { label: copy.companyLabel, help: copy.companyHelp ?? copy.help };
  }
  return { label: copy.label, help: copy.help };
}

export function sectionNavLabel(id: SectionId, answers: Record<string, string>): string {
  if (id === "review") return "Review and send";
  return sectionCopy(id, answers).title;
}

export function sectionCopy(id: SectionId, answers: Record<string, string>): { title: string; intro: string } {
  if (id === "details" && isCompany(answers)) {
    return { title: "Company and representative", intro: "Add the company that owns the property and the person completing this form for it. Those are different roles." };
  }
  return SECTION_COPY[id];
}

export function visibleSections(kind: IntakeKind, answers: Record<string, string>, fields: readonly { key: string }[]): SectionId[] {
  const present = new Set(fields.map((field) => field.key));
  const sections = (Object.keys(SECTION_FIELDS) as Array<Exclude<SectionId, "review">>).filter((id) =>
    SECTION_FIELDS[id].some((key) => present.has(key) && isFieldVisible(key, answers, present))
  );
  if (kind === "sole") {
    return [...sections.filter((id) => id !== "checks"), "review"];
  }
  return [...sections, "review"];
}

export function fieldsInSection(section: SectionId, fields: readonly ClientField[], answers: Record<string, string>): ClientField[] {
  if (section === "review") return [];
  const present = new Set(fields.map((field) => field.key));
  const order = new Map(SECTION_FIELDS[section].map((key, index) => [key, index]));
  return fields
    .filter((field) => order.has(field.key) && isFieldVisible(field.key, answers, present))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

export function answersForSave(answers: Record<string, string>, present?: ReadonlySet<string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (present && !present.has(key)) continue;
    if (!isFieldVisible(key, answers, present)) continue;
    next[key] = value;
  }
  if (isCompany(answers)) {
    for (const [target, source] of Object.entries(SAME_PERSON)) {
      const onForm = present ? present.has(target) && present.has(source) : source in answers && target in answers;
      if (!onForm) continue;
      const shown = answers[source] ?? "";
      const hidden = answers[target]?.trim() ?? "";
      if (!hidden || hidden === shown.trim()) next[target] = shown;
    }
  }
  return next;
}

export function formatDisplayDate(value: string | undefined): string | null {
  const iso = isoDateOrNull(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[month - 1]} ${year}`;
}

export function dateOrderError(answers: Record<string, string>): string | null {
  const start = isoDateOrNull(answers.mandateStartDate);
  const end = isoDateOrNull(answers.mandateEndDate);
  if (!start || !end) return null;
  if (end <= start) return "The mandate end date needs to be after the start date.";
  return null;
}

export function priceError(key: "mandatePrice" | "askingPrice", value: string | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return key === "mandatePrice"
      ? "Please enter a valid amount for the mandate price."
      : "Please enter your asking price before commission.";
  }
  if (!/\d/.test(raw)) return "Please enter a valid amount for the mandate price.";
  return null;
}

export function submitErrors(kind: IntakeKind, answers: Record<string, string>): Array<{ key: string; message: string }> {
  const present = new Set(fieldsForKind(kind).map((field) => field.key));
  const errors: Array<{ key: string; message: string }> = [];
  const need = (key: string, message: string) => {
    if (present.has(key) && isFieldVisible(key, answers) && !answers[key]?.trim()) errors.push({ key, message });
  };
  need("propertyAddress", "Please enter the property address so your agent can identify the property.");
  need("registeredOwner", "Please enter the registered owner's name as shown on the ownership documents.");
  if (present.has("mandatePrice")) {
    const message = priceError("mandatePrice", answers.mandatePrice);
    if (message) errors.push({ key: "mandatePrice", message });
  }
  if (present.has("askingPrice")) {
    const message = priceError("askingPrice", answers.askingPrice);
    if (message) errors.push({ key: "askingPrice", message });
  }
  if (isCompany(answers)) {
    need("companyName", "Please enter the registered company name.");
    need("representativeName", "Please enter the name of the person completing this for the company.");
  }
  const dates = dateOrderError(answers);
  if (dates && present.has("mandateEndDate")) errors.push({ key: "mandateEndDate", message: dates });
  return errors;
}

export function sectionForKey(key: string): SectionId {
  for (const [section, keys] of Object.entries(SECTION_FIELDS) as Array<[Exclude<SectionId, "review">, readonly string[]]>) {
    if (keys.includes(key)) return section;
  }
  return "review";
}

const SMALL = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(value: number): string {
  if (value < 20) return SMALL[value];
  if (value < 100) {
    const ten = TENS[Math.floor(value / 10)];
    const rest = value % 10;
    return rest ? `${ten}-${SMALL[rest]}` : ten;
  }
  const hundred = `${SMALL[Math.floor(value / 100)]} hundred`;
  const rest = value % 100;
  return rest ? `${hundred} and ${underThousand(rest)}` : hundred;
}

export function suggestPriceWords(raw: string | undefined): string | null {
  const cleaned = raw?.replace(/,/g, "").trim() ?? "";
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction] = cleaned.split(".");
  if (whole.length > 9) return null;
  const scales = ["", " thousand", " million"];
  let remaining = Number(whole);
  const parts: string[] = [];
  for (let scale = scales.length - 1; scale >= 0; scale -= 1) {
    const unit = 1000 ** scale;
    const count = Math.floor(remaining / unit);
    if (count) {
      parts.push(`${underThousand(count)}${scales[scale]}`);
      remaining -= count * unit;
    }
  }
  let words = parts.join(", ") || "zero";
  words = words.charAt(0).toUpperCase() + words.slice(1);
  if (fraction && Number(fraction) > 0) words += ` and ${fraction.padEnd(2, "0")}/100`;
  return words;
}

export function clientTermsCopy(note: string | null): string | null {
  if (!note) return null;
  const months = note.match(/minimum of (\d+) months/);
  const continues = note.includes("continues until the owner varies");
  if (!months && !continues) {
    return "This sole mandate does not state a minimum exclusive period or an end date. Sending this form does not sign it.";
  }
  const parts = ["This is a sole mandate."];
  if (months) parts.push(`Once it is signed, the approved terms run for at least ${months[1]} months from the signature date.`);
  if (continues) parts.push("They then continue until the owner changes them in writing.");
  parts.push("This form does not sign the mandate or choose a signature date.");
  return parts.join(" ");
}

export function attentionSection(sections: readonly SectionId[], fields: readonly ClientField[], answers: Record<string, string>): number {
  const index = sections.findIndex((section) => fieldsInSection(section, fields, answers).some((field) => field.instruction));
  return index >= 0 ? index : 0;
}
