import type { OpenPdfData, PaperBrand, SolePdfData } from "@/components/real-estate/seller-intake/MandatePaper";

export type MandateMarks = {
  place: string;
  signature: string;
  witness: string;
  witnessSign: string;
  surety: boolean;
};

export const emptyMarks: MandateMarks = { place: "", signature: "", witness: "", witnessSign: "", surety: false };

export function paperBrand(input: { name?: string | null; phone?: string | null; signedOn: string }): PaperBrand {
  return {
    name: input.name?.trim() || "The agency",
    phones: input.phone?.trim() || undefined,
    signedOn: input.signedOn,
  };
}

export function signedOnToday() {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

function moneyDigits(value: string | undefined) {
  return (value ?? "").replace(/[^0-9.]/g, "");
}

function clean(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (text === "Submitted for a permitted reviewer") return "";
  return text;
}

export function solePaper(answers: Record<string, string>, marks: MandateMarks): SolePdfData {
  const company = answers.ownerKind === "Company";
  return {
    address: clean(answers.propertyAddress),
    owner: clean(answers.registeredOwner),
    home: clean(answers.residentialAddress),
    mobile: clean(answers.cell),
    price: moneyDigits(answers.askingPrice),
    ownerKind: company ? "company" : "person",
    signerKind: company ? "authorised" : "owner",
    signer: clean(answers.representativeName),
    authority: clean(answers.representativePhone),
    surety: company && marks.surety,
    place: marks.place,
    signature: marks.signature,
    witness: marks.witness,
    witnessSign: marks.witnessSign,
  };
}

export function openPaper(answers: Record<string, string>, marks: MandateMarks): OpenPdfData {
  const company = answers.ownerKind === "Company";
  const category = answers.propertyCategory === "Other" ? clean(answers.propertyCategoryOther) : clean(answers.propertyCategory);
  const payment = answers.paymentMode === "Other" ? clean(answers.paymentModeOther) : clean(answers.paymentMode);
  const seller = [clean(answers.sellerTitle), clean(answers.givenName), clean(answers.surname)].filter(Boolean).join(" ");
  const occupation = answers.occupation === "Tenant occupied"
    ? `Tenant occupied. ${clean(answers.occupantName)}${clean(answers.occupantPhone) ? `, ${clean(answers.occupantPhone)}` : ""}`
    : clean(answers.occupation);
  return {
    address: clean(answers.propertyAddress),
    owner: clean(answers.registeredOwner),
    category,
    rights: clean(answers.propertyRights),
    deed: clean(answers.titleReference),
    description: clean(answers.propertyDescription),
    occupation,
    start: clean(answers.mandateStartDate),
    end: clean(answers.mandateEndDate),
    price: moneyDigits(answers.mandatePrice),
    words: clean(answers.mandatePriceWords),
    payment,
    asking: moneyDigits(answers.askingPrice),
    seller,
    nationality: clean(answers.nationality),
    identity: clean(answers.identityNumber),
    marital: clean(answers.maritalStatus),
    spouse: clean(answers.spouseName),
    cell: clean(answers.cell),
    email: clean(answers.email),
    home: clean(answers.residentialAddress),
    pep: clean(answers.pep),
    occupationJob: clean(answers.occupationJob),
    industry: clean(answers.industry),
    position: clean(answers.position),
    employer: clean(answers.employerName),
    employerAddress: clean(answers.employerAddress),
    funds: clean(answers.sourceOfFunds),
    company: company ? clean(answers.companyName) : null,
    companyAddress: clean(answers.companyAddress),
    companyIndustry: clean(answers.companyIndustry),
    companyEmail: clean(answers.companyEmail),
    companyPhone: clean(answers.companyPhones),
    representative: clean(answers.representativeName),
    representativeId: clean(answers.representativeIdentity),
    representativeRole: clean(answers.representativePosition),
    representativeAddress: clean(answers.representativeAddress),
    representativePhone: clean(answers.representativePhone),
    holders: clean(answers.shareholderLines).split(/\n+/).map((line) => line.trim()).filter(Boolean),
    documents: [],
    surety: company && marks.surety,
    place: marks.place,
    signature: marks.signature,
    witness: marks.witness,
    witnessSign: marks.witnessSign,
  };
}
