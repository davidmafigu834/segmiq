import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMandateCompliance } from "../lib/real-estate/seller-intake/compliance-checks";

const openAnswers = {
  ownerKind: "Individual",
  registeredOwner: "Tariro Moyo",
  propertyAddress: "12 Baines Avenue, Avondale, Harare",
  propertyCategory: "House",
  propertyRights: "Full Title",
  titleReference: "DT 4821/2014",
  sellerTitle: "Ms",
  givenName: "Tariro",
  surname: "Moyo",
  nationality: "Zimbabwean",
  identityNumber: "75-234567-B-42",
  maritalStatus: "Married",
  spouseName: "Farai Moyo",
  cell: "+263 77 412 8806",
  residentialAddress: "12 Baines Avenue, Avondale, Harare",
  occupationJob: "Accountant",
  industry: "Professional services",
  position: "Finance manager",
  employerName: "Ndoro & Co",
  employerAddress: "8 Samora Machel Avenue, Harare",
  sourceOfFunds: "Salary and savings from employment",
  pep: "No",
  mandateStartDate: "2026-11-07",
  mandateEndDate: "2027-05-07",
  mandatePrice: "185000",
  askingPrice: "185000",
};

test("a completed individual mandate is good except for items the form never asks", () => {
  const report = evaluateMandateCompliance("open", openAnswers);
  assert.equal(report.missing.length, 0);
  assert.equal(report.attention.length, 0);
  assert.equal(report.recorded.find((item) => item.key === "identity")?.detail, "75-234567-B-42");
  assert.equal(report.recorded.find((item) => item.key === "pep")?.detail, "No");
  assert.equal(report.recorded.find((item) => item.key === "name")?.detail, "Ms · Tariro · Moyo");
  assert.equal(report.recorded.some((item) => item.key === "industry_other"), false);
  assert.equal(report.recorded.some((item) => item.key === "spouse"), true);
  assert.deepEqual(report.notOnForm, [
    "Date of birth",
    "A copy of the identity document",
    "Proof of the residential address",
  ]);
  assert.match(report.summary, /checks are on the form/);
  assert.equal(report.summary.includes("blank"), false);
});

test("a blank identity number is reported as missing, and a Yes PEP needs a reviewer", () => {
  const report = evaluateMandateCompliance("open", {
    ...openAnswers,
    identityNumber: "",
    pep: "Yes",
    maritalStatus: "Single",
    spouseName: "Should not be required",
  });
  assert.equal(report.missing.find((item) => item.key === "identity")?.detail, "Not answered on the form");
  assert.equal(report.attention.find((item) => item.key === "pep")?.status, "attention");
  assert.equal(report.recorded.some((item) => item.key === "spouse"), false);
  assert.equal(report.missing.some((item) => item.key === "spouse"), false);
});

test("a hidden identity answer counts as recorded without showing the placeholder", () => {
  const report = evaluateMandateCompliance("open", {
    ...openAnswers,
    identityNumber: "Submitted for a permitted reviewer",
    sourceOfFunds: "Submitted for a permitted reviewer",
  });
  assert.equal(report.recorded.find((item) => item.key === "identity")?.detail, "Recorded on the form");
  assert.equal(report.recorded.find((item) => item.key === "funds")?.detail, "Recorded on the form");
  assert.equal(JSON.stringify(report).includes("Submitted for a permitted reviewer"), false);
});

test("a company form checks the company and does not ask for an individual date of birth", () => {
  const report = evaluateMandateCompliance("open", {
    ownerKind: "Company",
    registeredOwner: "Moyo Holdings",
    companyName: "Moyo Holdings",
    companyAddress: "8 Samora Machel Avenue, Harare",
    companyIndustry: "Property holding",
    representativeName: "Tariro Ncube",
    representativePosition: "Director",
    propertyAddress: "12 Cork Road",
    propertyCategory: "Commercial",
    propertyRights: "Full Title",
    titleReference: "DT 1/2020",
    askingPrice: "150",
    mandatePrice: "100",
    cell: "0774444444",
    sellerTitle: "Ms",
    givenName: "Tariro",
    surname: "Ncube",
    nationality: "Zimbabwean",
    identityNumber: "75-000000-A-00",
    maritalStatus: "Single",
    residentialAddress: "1 Home Road",
    occupationJob: "Director",
    industry: "Professional services",
    position: "Director",
    employerName: "Moyo Holdings",
    employerAddress: "8 Samora Machel Avenue",
    sourceOfFunds: "Company revenue",
    pep: "No",
    mandateStartDate: "2026-11-07",
    mandateEndDate: "2027-05-07",
  });
  assert.equal(report.recorded.some((item) => item.key === "company"), true);
  assert.equal(report.missing.find((item) => item.key === "shareholders")?.label, "Shareholders of 10 percent or more");
  assert.equal(report.notOnForm.includes("Company registration number"), true);
  assert.equal(report.notOnForm.includes("Date of birth"), false);
});

test("a sole mandate only checks the answers that form asks for", () => {
  const report = evaluateMandateCompliance("sole", {
    ownerKind: "Individual",
    registeredOwner: "Rudo Moyo",
    propertyAddress: "Stand 4",
    residentialAddress: "Stand 4",
    cell: "0770000000",
    askingPrice: "500000",
  });
  assert.equal(report.recorded.some((item) => item.key === "nationality"), false);
  assert.equal(report.recorded.some((item) => item.key === "pep"), false);
  assert.equal(report.missing.some((item) => item.key === "identity"), false);
  assert.equal(report.recorded.find((item) => item.key === "asking")?.detail, "500000");
});
