import assert from "node:assert/strict";
import test from "node:test";
import { buildSellerRecord, brandInk, sellerRecordFilename } from "../lib/real-estate/seller-intake/record";
import { renderSellerRecordPdf } from "../lib/real-estate/seller-intake/record-pdf";

const answers = {
  ownerKind: "Individual",
  registeredOwner: "Tariro Moyo",
  propertyAddress: "12 Baines Avenue, Avondale, Harare",
  propertyCategory: "House",
  propertyCategoryOther: "Should stay hidden",
  propertyRights: "Full Title",
  titleReference: "DT 4821/2014",
  propertyDescription: "3 bedroom house, 2 bathrooms, double garage.",
  occupation: "Owner occupied",
  occupantName: "Tariro Moyo",
  occupantPhone: "+263 77 412 8806",
  sellerTitle: "Ms",
  givenName: "Tariro",
  surname: "Moyo",
  nationality: "Zimbabwean",
  identityNumber: "75-234567-B-42",
  maritalStatus: "Married",
  spouseName: "Farai Moyo",
  cell: "+263 77 412 8806",
  email: "tariro.moyo.demo@example.com",
  residentialAddress: "12 Baines Avenue, Avondale, Harare",
  occupationJob: "Accountant",
  industry: "Other",
  industryOther: "Accounting practice",
  position: "Finance manager",
  employerName: "Ndoro & Co",
  employerAddress: "8 Samora Machel Avenue, Harare",
  sourceOfFunds: "Salary and savings from employment",
  pep: "No",
  mandateStartDate: "2026-11-07",
  mandateEndDate: "2027-05-07",
  mandatePrice: "185000",
  mandatePriceWords: "One hundred and eighty five thousand dollars",
  paymentMode: "Electronic",
  askingPrice: "185000",
};

test("seller record keeps the form sections and only the answers that apply", () => {
  const record = buildSellerRecord({
    kind: "open",
    answers,
    agencyName: "Haven Properties",
    brandColor: "#0F7A4F",
    submittedAt: "2026-11-07T12:00:00.000Z",
    templateTitle: "Open mandate",
  });
  assert.equal(record.agencyName, "Haven Properties");
  assert.equal(record.sellerName, "Tariro Moyo");
  assert.equal(record.kindLabel, "Open mandate");
  assert.equal(record.submittedLabel, "7 Nov 2026");
  assert.deepEqual(record.sections.map((section) => section.id), ["ownership", "property", "details", "checks", "instructions"]);
  const property = record.sections.find((section) => section.id === "property");
  assert.equal(property?.rows.some((row) => row.key === "propertyCategoryOther"), false);
  assert.equal(property?.rows.find((row) => row.key === "propertyCategory")?.value, "House");
  const checks = record.sections.find((section) => section.id === "checks");
  assert.equal(checks?.rows.find((row) => row.key === "industry")?.value, "Other");
  assert.equal(checks?.rows.find((row) => row.key === "industryOther")?.value, "Accounting practice");
  const instructions = record.sections.find((section) => section.id === "instructions");
  assert.equal(instructions?.rows.find((row) => row.key === "mandatePrice")?.value, "185,000");
  assert.equal(instructions?.rows.find((row) => row.key === "mandateStartDate")?.value, "7 Nov 2026");
  assert.equal(record.sections.find((section) => section.id === "details")?.rows.find((row) => row.key === "sellerTitle")?.value, "Ms");
  assert.equal(record.restrictedNote, null);
  assert.equal(sellerRecordFilename(record.sellerName), "Tariro-Moyo-mandate.pdf");
  assert.equal(brandInk("#0F7A4F"), "light");
  assert.equal(brandInk("#F4F1EA"), "dark");
});

test("a company record uses the company sections and hides a repeated representative number", () => {
  const record = buildSellerRecord({
    kind: "open",
    answers: {
      ownerKind: "Company",
      registeredOwner: "Moyo Holdings",
      companyName: "Moyo Holdings",
      representativeName: "Tariro Ncube",
      propertyAddress: "12 Cork Road",
      cell: "0774444444",
      representativePhone: "0774444444",
      askingPrice: "150",
      mandatePrice: "100",
    },
    agencyName: "Haven Properties",
    restrictedPending: true,
  });
  assert.equal(record.sellerName, "Moyo Holdings");
  assert.equal(record.sections.find((section) => section.id === "details")?.title, "Company and representative");
  const details = record.sections.find((section) => section.id === "details");
  assert.equal(details?.rows.some((row) => row.key === "representativePhone"), false);
  assert.equal(details?.rows.some((row) => row.key === "companyName"), true);
  assert.match(record.restrictedNote ?? "", /permitted reviewer/);
});

test("a sole mandate does not invent the open-mandate checks", () => {
  const record = buildSellerRecord({
    kind: "sole",
    answers: {
      registeredOwner: "Rudo Moyo",
      propertyAddress: "Stand 4",
      residentialAddress: "Stand 4",
      cell: "0770000000",
      askingPrice: "500000",
      ownerKind: "Individual",
    },
    agencyName: "Haven Properties",
  });
  assert.equal(record.kindLabel, "Sole mandate");
  assert.equal(record.sections.some((section) => section.id === "checks"), false);
  assert.equal(record.sections.find((section) => section.id === "instructions")?.rows[0]?.value, "500,000");
});

test("the branded record renders as a PDF", async () => {
  const record = buildSellerRecord({
    kind: "open",
    answers,
    agencyName: "Haven Properties",
    brandColor: "not-a-color",
    logoUrl: "http://example.com/logo.png",
    submittedAt: "2026-11-07T12:00:00.000Z",
  });
  assert.equal(record.brandColor, "#16342A");
  assert.equal(record.logoUrl, null);
  const bytes = await renderSellerRecordPdf(record);
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.ok(bytes.length > 1000);
});
