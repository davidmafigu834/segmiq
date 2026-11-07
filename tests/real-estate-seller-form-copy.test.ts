import assert from "node:assert/strict";
import test from "node:test";
import { fieldsForKind } from "@/lib/real-estate/seller-intake/fields";
import {
  SAVE_FAILURE,
  answersForSave,
  attentionSection,
  clientTermsCopy,
  dateOrderError,
  fieldCopy,
  formatDisplayDate,
  sectionForKey,
  submitErrors,
  suggestPriceWords,
  visibleSections,
  type ClientField,
} from "@/lib/real-estate/seller-intake/client-form";

function fields(kind: "open" | "sole", values: Record<string, string> = {}, extras: Partial<ClientField> = {}): ClientField[] {
  return fieldsForKind(kind).map((field) => ({
    key: field.key,
    input: field.input,
    options: field.options,
    requiredToSubmit: field.requiredToSubmit,
    value: values[field.key] ?? "",
    locked: false,
    instruction: null,
    ...extras,
  }));
}

test("guided sections follow the owner type and hide irrelevant answers from the save", () => {
  const open = fields("open");
  const individual = visibleSections("open", { ownerKind: "Individual" }, open);
  assert.deepEqual(individual, ["ownership", "property", "details", "checks", "instructions", "review"]);
  assert.equal(fieldCopy("ownerKind", {}).label, "Who owns the property?");
  assert.equal(fieldCopy("givenName", { ownerKind: "Company" }).label, "Representative's first name(s)");
  assert.equal(fieldCopy("shareholderLines", { ownerKind: "Company" }).label, "Shareholders with 10% ownership or more");
  assert.equal(fieldCopy("occupation", {}).label, "Who currently occupies the property?");
  assert.equal(fieldCopy("occupationJob", {}).label, "What kind of work do you do?");

  const stale = {
    ownerKind: "Individual",
    propertyAddress: "12 Baker Street",
    propertyCategory: "House",
    propertyCategoryOther: "Should not be sent",
    maritalStatus: "Single",
    spouseName: "Should not be sent",
    occupation: "",
    occupantName: "Should not be sent",
    companyName: "Should not be sent",
    representativeName: "Should not be sent",
    paymentMode: "Cash",
    paymentModeOther: "Should not be sent",
    industry: "Education",
    industryOther: "Should not be sent",
    mandatePrice: "80000",
    mandatePriceWords: "Eighty thousand",
  };
  const saved = answersForSave(stale);
  assert.equal(saved.propertyAddress, "12 Baker Street");
  assert.equal(saved.mandatePriceWords, "Eighty thousand");
  assert.equal("companyName" in saved, false);
  assert.equal("spouseName" in saved, false);
  assert.equal("propertyCategoryOther" in saved, false);
  assert.equal("paymentModeOther" in saved, false);
  assert.equal("industryOther" in saved, false);
  assert.equal("occupantName" in saved, false);

  const company = answersForSave({ ...stale, ownerKind: "Company", companyName: "Moyo Holdings", representativeName: "Tariro Ncube", maritalStatus: "Married", spouseName: "Ada Ncube", occupation: "Tenant occupied", occupantName: "Tenant Person" });
  assert.equal(company.companyName, "Moyo Holdings");
  assert.equal(company.representativeName, "Tariro Ncube");
  assert.equal(company.spouseName, "Ada Ncube");
  assert.equal(company.occupantName, "Tenant Person");
  assert.equal(company.givenName, undefined);
  const present = new Set(["identityNumber", "representativeIdentity", "cell", "representativePhone"]);
  const mirrored = answersForSave({ ownerKind: "Company", identityNumber: "63-1", representativeIdentity: "", cell: "+26377111", representativePhone: "" }, present);
  assert.equal(mirrored.representativeIdentity, "63-1");
  assert.equal(mirrored.representativePhone, "+26377111");
  const distinct = answersForSave({ ownerKind: "Company", identityNumber: "63-1", representativeIdentity: "99-2", cell: "+26377111", representativePhone: "+26377222" }, present);
  assert.equal(distinct.representativeIdentity, "99-2");
  assert.equal(distinct.representativePhone, "+26377222");
});

test("sole mandate drops empty sections and does not invent an end date", () => {
  const sole = visibleSections("sole", { ownerKind: "Individual" }, fields("sole"));
  assert.deepEqual(sole, ["ownership", "property", "details", "instructions", "review"]);
  assert.equal(fields("sole").some((field) => field.key === "mandateEndDate"), false);
  assert.equal(clientTermsCopy("This template does not state a minimum exclusive period or an end date. No expiry date was added.")?.includes("invented"), false);
  assert.match(clientTermsCopy("The template says a minimum of 3 months measured from the signature date. It then continues until the owner varies it in writing. No signature date or expiry date was invented.") ?? "", /3 months/);
});

test("required guidance, dates and prices keep their meanings", () => {
  const missing = submitErrors("open", { ownerKind: "Individual" });
  assert.deepEqual(missing.map((item) => item.key), ["propertyAddress", "registeredOwner", "mandatePrice", "askingPrice"]);
  assert.equal(missing[0].message, "Please enter the property address so your agent can identify the property.");
  assert.equal(missing[1].message, "Please enter the registered owner's name as shown on the ownership documents.");
  assert.equal(missing[2].message, "Please enter a valid amount for the mandate price.");
  assert.equal(submitErrors("open", { ownerKind: "Company", propertyAddress: "1 Main", registeredOwner: "Moyo Holdings", mandatePrice: "abc", askingPrice: "1" }).some((item) => item.key === "companyName"), true);
  assert.equal(dateOrderError({ mandateStartDate: "2026-11-05", mandateEndDate: "2026-11-05" }), "The mandate end date needs to be after the start date.");
  assert.equal(dateOrderError({ mandateStartDate: "2026-11-05" }), null);
  assert.equal(formatDisplayDate("2026-11-05"), "5 Nov 2026");
  assert.equal(suggestPriceWords("125000.50"), "One hundred and twenty-five thousand and 50/100");
  const kept = { mandatePrice: "125000.50", mandatePriceWords: "Already written" };
  const words = kept.mandatePriceWords.trim() ? kept.mandatePriceWords : suggestPriceWords(kept.mandatePrice);
  assert.equal(words, "Already written");
  assert.equal(sectionForKey("mandatePrice"), "instructions");
});

test("correction opens the section the agent sent back, and a failed save keeps its copy", () => {
  const open = fields("open", { propertyAddress: "Old" }).map((field) => field.key === "propertyAddress" ? { ...field, instruction: "Use the stand number." } : field);
  const sections = visibleSections("open", {}, open);
  assert.equal(sections[attentionSection(sections, open, {})], "property");
  assert.equal(SAVE_FAILURE, "We couldn't save your latest changes. Please try again before leaving this page.");
});
