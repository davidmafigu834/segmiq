"use client";

import { useState } from "react";
import { DueDiligenceDashboard, type DueDiligenceListRow } from "@/components/real-estate/due-diligence/DueDiligenceDashboard";
import { DueDiligenceReport, type DueDiligenceFile } from "@/components/real-estate/due-diligence/ReportView";
import type { DocumentExtraction, DocumentType, TenureType } from "@/lib/real-estate/due-diligence/types";

const opened = {
  tendai: "2026-11-10T09:12:00.000Z",
  rudo: "2026-11-08T14:40:00.000Z",
  david: "2026-11-02T08:05:00.000Z",
  amina: "2026-10-20T11:20:00.000Z",
};

const ROWS: DueDiligenceListRow[] = [
  row("tendai", "DD-1042", "report_ready", "conditional_pass", 75, opened.tendai, "Tendai Moyo", "12 Baines Avenue", "1234", "Borrowdale", "Harare", "title_deed"),
  row("rudo", "DD-1038", "report_ready", "fail", 45, opened.rudo, "Rudo Ncube", "4 Borrowdale Brooke", "88", "Borrowdale", "Harare", "title_deed"),
  row("david", "DD-1011", "cleared", "pass", 92, opened.david, "David Mafigu", "Stand 16, Chadcombe", "16", "Chadcombe", "Harare", "developer_cession"),
  row("amina", "DD-0994", "draft", null, null, opened.amina, "Amina Cruz", "8 Stonechat Lane", "8", "Mount Pleasant", "Harare", "council_cession"),
];

const FILES: Record<string, DueDiligenceFile> = {
  tendai: file({
    id: "tendai",
    reference: "DD-1042",
    status: "report_ready",
    reportStatus: "conditional_pass",
    score: 75,
    created: opened.tendai,
    seller: { fullName: "Tendai Moyo", idNumber: "12345678A12", phone: "+263 77 200 1144", email: "tendai@example.com", maritalStatus: "single" },
    property: { address: "12 Baines Avenue", standNumber: "1234", suburb: "Borrowdale", city: "Harare", tenureType: "title_deed", askingPriceUsd: 185000, localAuthority: "City of Harare" },
    summary: "Tendai Moyo's file scored 75 of 100, a conditional pass. 80 and above is a pass. Close the open items before treating the property as cleared.",
    reasons: ["Request an official Deeds Registry search through a conveyancer. This system cannot replace the Deeds Office."],
    recommendations: [
      "Request an official Deeds Registry search through a conveyancer. This system cannot replace the Deeds Office.",
      "SI 76 of 2025 and the Digital Land Administration Platform (DLAP): older paper deeds may need validation against the registry before transfer.",
      "Arrange conveyancer review before marketing this property as cleared.",
    ],
    missing: [],
    identity: {
      provider: "smile_id",
      status: "inconclusive",
      decision: "review",
      confidence: 91,
      detail: "The selfie matched the photo on the National ID. A full liveness sequence was not captured, so this stays a review.",
      reference: "job-1042",
      returnedName: "Tendai Moyo",
      documentChecked: true,
      faceMatch: "matched",
      liveness: "not_captured",
    },
    documents: [
      doc("id", "national_id", "national-id.jpg", { fullName: "Tendai Moyo", idNumber: "12345678A12", dateOfBirth: "1988-04-12" }),
      doc("deed", "title_deed", "title-deed.pdf", { fullName: "Moyo Tendai", standNumber: "1234", suburb: "Borrowdale", city: "Harare", deedNumber: "1234/2020", localAuthority: "City of Harare" }),
      doc("rates", "rates_clearance", "rates-clearance.pdf", { fullName: "Tendai Moyo", localAuthority: "City of Harare", issueDate: "2026-09-01", expiryDate: "2026-12-01" }),
    ],
    checks: [
      check("document_national_id", "National ID", "pass", "National ID is on the file."),
      check("document_title_deed", "Title deed", "pass", "Title deed is on the file."),
      check("document_rates_clearance", "Rates clearance", "pass", "Rates clearance is on the file."),
      check("identity_name_match", "Name match", "pass", "The seller's name matches the name read from the documents."),
      check("identity_verification", "Identity verification", "warning", "The selfie matched the photo on the National ID. A full liveness sequence was not captured, so this stays a review."),
      check("deeds_registry_search", "Deeds Registry search", "warning", "Request an official Deeds Registry search through a conveyancer. This system cannot replace the Deeds Office."),
      check("rates_expiry", "Rates clearance expiry", "pass", "Rates clearance is dated in force until 2026-12-01."),
    ],
  }),
  rudo: file({
    id: "rudo",
    reference: "DD-1038",
    status: "report_ready",
    reportStatus: "fail",
    score: 45,
    created: opened.rudo,
    seller: { fullName: "Rudo Ncube", idNumber: "63123456B18", phone: "+263 77 411 2200", email: "rudo@example.com", maritalStatus: "married" },
    property: { address: "4 Borrowdale Brooke", standNumber: "88", suburb: "Borrowdale", city: "Harare", tenureType: "title_deed", askingPriceUsd: 240000, localAuthority: "City of Harare" },
    summary: "Rudo Ncube's file scored 45 of 100, which is below 50 and fails. Do not market it as cleared until the failed items are resolved.",
    reasons: ["The name on the form does not match a name read from title-deed.pdf."],
    recommendations: [
      "Request an official Deeds Registry search through a conveyancer. This system cannot replace the Deeds Office.",
      "Arrange conveyancer review before marketing this property as cleared.",
    ],
    missing: ["Rates clearance"],
    identity: {
      provider: "smile_id",
      status: "verified",
      decision: "clear",
      confidence: 97,
      detail: "Document and face matched. Liveness passed.",
      reference: "job-1038",
      returnedName: "Rudo Ncube",
      documentChecked: true,
      faceMatch: "matched",
      liveness: "passed",
    },
    documents: [
      doc("id", "national_id", "rudo-id.jpg", { fullName: "Rudo Ncube", idNumber: "63123456B18" }),
      doc("deed", "title_deed", "title-deed.pdf", { fullName: "Tendai Moyo", standNumber: "88", suburb: "Borrowdale", deedNumber: "88/2014" }),
    ],
    checks: [
      check("document_national_id", "National ID", "pass", "National ID is on the file."),
      check("document_title_deed", "Title deed", "pass", "Title deed is on the file."),
      check("document_rates_clearance", "Rates clearance", "fail", "Rates clearance is missing."),
      check("identity_name_match", "Name match", "fail", "The name on the form does not match a name read from title-deed.pdf."),
      check("identity_verification", "Identity verification", "pass", "Document and face matched. Liveness passed."),
    ],
    comparisonConsistent: false,
  }),
  david: file({
    id: "david",
    reference: "DD-1011",
    status: "cleared",
    reportStatus: "pass",
    score: 92,
    created: opened.david,
    seller: { fullName: "David Mafigu", idNumber: "08111222C90", phone: "+263 71 555 0190", email: "david@example.com", maritalStatus: "single" },
    property: { address: "Stand 16, Chadcombe", standNumber: "16", suburb: "Chadcombe", city: "Harare", tenureType: "developer_cession", askingPriceUsd: 72000, localAuthority: "City of Harare" },
    summary: "David Mafigu's file scored 92 of 100, which is a pass. You can record clearance. Transfer still goes through a conveyancer.",
    reasons: [],
    recommendations: ["Keep the subdivision permit and development permit together. A later title still needs the Deeds Registry."],
    missing: [],
    identity: {
      provider: "smile_id",
      status: "verified",
      decision: "clear",
      confidence: 98,
      detail: "Document and face matched. Liveness passed.",
      reference: "job-1011",
      returnedName: "David Mafigu",
      documentChecked: true,
      faceMatch: "matched",
      liveness: "passed",
    },
    documents: [
      doc("id", "national_id", "david-id.jpg", { fullName: "David Mafigu", idNumber: "08111222C90" }),
      doc("sub", "subdivision_permit", "subdivision-permit.pdf", { fullName: "David Mafigu", standNumber: "16", suburb: "Chadcombe", permitNumber: "SP-16" }),
      doc("dev", "development_permit", "development-permit.pdf", { fullName: "David Mafigu", standNumber: "16", suburb: "Chadcombe", permitNumber: "DP-16" }),
    ],
    checks: [
      check("document_national_id", "National ID", "pass", "National ID is on the file."),
      check("document_subdivision_permit", "Subdivision permit", "pass", "Subdivision permit is on the file."),
      check("document_development_permit", "Development permit", "pass", "Development permit is on the file."),
      check("identity_verification", "Identity verification", "pass", "Document and face matched. Liveness passed."),
    ],
  }),
  amina: file({
    id: "amina",
    reference: "DD-0994",
    status: "draft",
    reportStatus: null,
    score: null,
    created: opened.amina,
    seller: { fullName: "Amina Cruz", idNumber: "22999888D01", phone: "+263 78 300 4411", email: "", maritalStatus: "single" },
    property: { address: "8 Stonechat Lane", standNumber: "8", suburb: "Mount Pleasant", city: "Harare", tenureType: "council_cession", askingPriceUsd: null, localAuthority: "City of Harare" },
    summary: "",
    reasons: [],
    recommendations: [],
    missing: [],
    identity: null,
    documents: [],
    checks: [],
    report: null,
  }),
};

export function DueDiligenceMock() {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? FILES[openId] : null;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-sales-text-secondary">Sample records for the due diligence desk. Filters and review buttons stay on this page. Nothing is saved.</p>
      {open ? (
        <DueDiligenceReport clientId="sample" mandateId={open.mandate.id} basePath="/dev/real-estate-ui" sampleFile={open} onBack={() => setOpenId(null)} />
      ) : (
        <DueDiligenceDashboard clientId="sample" basePath="/dev/real-estate-ui" sampleRows={ROWS} onOpen={setOpenId} />
      )}
    </div>
  );
}

function row(
  id: string,
  reference: string,
  status: string,
  reportStatus: DueDiligenceListRow["report_status"],
  score: number | null,
  created: string,
  name: string,
  address: string,
  stand: string,
  suburb: string,
  city: string,
  tenure: TenureType
): DueDiligenceListRow {
  return {
    id,
    reference,
    status,
    report_status: reportStatus,
    risk_score: score,
    created_at: created,
    updated_at: created,
    re_dd_sellers: { full_name: name },
    re_dd_properties: { address, stand_number: stand, suburb, city, tenure_type: tenure },
  };
}

function check(code: string, label: string, status: "pass" | "warning" | "fail", detail: string) {
  return { code, label, status, critical: status === "fail", weight: status === "fail" ? 55 : status === "warning" ? 25 : 0, detail, evidence: {}, source: "rules" as const, note: null };
}

function doc(id: string, documentType: DocumentType, fileName: string, fields: Partial<DocumentExtraction["fields"]>) {
  const extracted: DocumentExtraction = {
    documentType,
    confidence: 0.92,
    quality: "readable",
    qualityNotes: "",
    redFlags: [],
    fields: {
      fullName: null,
      otherNames: [],
      idNumber: null,
      dateOfBirth: null,
      propertyDescription: null,
      standNumber: null,
      suburb: null,
      city: null,
      deedNumber: null,
      agreementNumber: null,
      localAuthority: null,
      issueDate: null,
      expiryDate: null,
      developerName: null,
      permitNumber: null,
      restrictions: [],
      ...fields,
    },
  };
  return { id, documentType, fileName, contentType: fileName.endsWith(".jpg") ? "image/jpeg" : "application/pdf", status: "extracted", extractionError: null, extracted };
}

function file(input: {
  id: string;
  reference: string;
  status: string;
  reportStatus: DueDiligenceFile["mandate"]["report_status"];
  score: number | null;
  created: string;
  seller: NonNullable<DueDiligenceFile["seller"]>;
  property: NonNullable<DueDiligenceFile["property"]>;
  summary: string;
  reasons: string[];
  recommendations: string[];
  missing: string[];
  identity: DueDiligenceFile["mandate"]["identity_result"];
  documents: DueDiligenceFile["documents"];
  checks: DueDiligenceFile["checks"];
  report?: null;
  comparisonConsistent?: boolean;
}): DueDiligenceFile {
  return {
    mandate: {
      id: input.id,
      reference: input.reference,
      status: input.status,
      report_status: input.reportStatus,
      risk_score: input.score,
      identity_result: input.identity,
      created_at: input.created,
    },
    seller: input.seller,
    property: input.property,
    documents: input.documents,
    checks: input.checks,
    reviews: [],
    audit: [
      { id: `${input.id}-created`, event_type: "mandate_created", created_at: input.created, payload: { actorName: "Mafico" } },
      ...(input.report === null ? [] : [{ id: `${input.id}-run`, event_type: "checks_run", created_at: input.created, payload: { actorName: "Mafico" } }]),
    ],
    report: input.report === null || input.score == null || !input.reportStatus ? null : {
      status: input.reportStatus,
      risk_score: input.score,
      summary: input.summary,
      reasons: input.reasons,
      recommendations: input.recommendations,
      missing_documents: input.missing,
      comparison: [
        { field: "Seller name", entered: input.seller.fullName, documents: input.documents.flatMap((item) => item.extracted?.fields.fullName ? [{ documentId: item.id, documentType: item.documentType, fileName: item.fileName, value: item.extracted.fields.fullName }] : []), consistent: input.comparisonConsistent !== false },
        { field: "Stand number", entered: input.property.standNumber, documents: input.documents.flatMap((item) => item.extracted?.fields.standNumber ? [{ documentId: item.id, documentType: item.documentType, fileName: item.fileName, value: item.extracted.fields.standNumber }] : []), consistent: true },
      ],
    },
  };
}
