"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/sales/ui/Button";
import { ReEmptyState, ReErrorState, RePageHeader, ReSection, ReSkeletonRows, ReStatusBadge } from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import {
  CHECK_STATUS_LABEL,
  DOCUMENT_LABEL,
  REPORT_LIMIT,
  REPORT_STATUS_LABEL,
  TENURE_LABEL,
  type CheckStatus,
  type ComparisonRow,
  type DocumentExtraction,
  type DocumentType,
  type DueDiligenceCheck,
  type IdentityOutcome,
  type ReportStatus,
  type TenureType,
} from "@/lib/real-estate/due-diligence/types";
import type { BadgeTone } from "@/components/sales/ui/Badge";

type CheckRow = DueDiligenceCheck & { source?: string; note?: string | null };

type ReportPayload = {
  status: ReportStatus;
  risk_score: number;
  summary: string;
  reasons: string[];
  recommendations: string[];
  comparison: ComparisonRow[];
  missing_documents: string[];
};

export type DueDiligenceFile = {
  mandate: {
    id: string;
    reference: string;
    status: string;
    report_status: ReportStatus | null;
    risk_score: number | null;
    identity_result: IdentityOutcome | null;
    created_at?: string;
  };
  seller: { fullName: string; idNumber: string; phone: string; email: string; maritalStatus: string } | null;
  property: { address: string; standNumber: string; suburb: string; city: string; tenureType: TenureType; askingPriceUsd: number | null; localAuthority: string } | null;
  documents: Array<{
    id: string;
    documentType: DocumentType;
    fileName: string;
    contentType?: string;
    status: string;
    extractionError: string | null;
    extracted: DocumentExtraction | null;
  }>;
  checks: CheckRow[];
  report: ReportPayload | null;
  reviews: Array<{ id: string; action: string; check_code: string | null; note: string | null; created_at: string; payload?: Record<string, unknown> }>;
  audit: Array<{ id: string; event_type: string; created_at: string; payload: Record<string, unknown> }>;
};

type FilePayload = DueDiligenceFile;

const EVENT_LABEL: Record<string, string> = {
  mandate_created: "Mandate opened",
  document_uploaded: "Document uploaded",
  extraction_completed: "Document read",
  extraction_failed: "Document could not be read",
  identity_checked: "Identity verification",
  checks_run: "Checks completed",
  checks_failed: "Checks failed",
  note_added: "Note added",
  check_overridden: "Check overridden",
  override_reverted: "Override reverted",
  clearance_marked: "Manually approved",
  clearance_rejected: "Rejected by the agent",
};

const DECISION_LABEL = { clear: "Clear", review: "Review", fail: "Fail" } as const;

const EXTRACTED_LABEL: Array<[keyof DocumentExtraction["fields"], string]> = [
  ["fullName", "Name"],
  ["idNumber", "ID number"],
  ["dateOfBirth", "Date of birth"],
  ["propertyDescription", "Property"],
  ["standNumber", "Stand"],
  ["suburb", "Suburb"],
  ["city", "City"],
  ["deedNumber", "Deed number"],
  ["agreementNumber", "Agreement number"],
  ["localAuthority", "Local authority"],
  ["issueDate", "Issue date"],
  ["expiryDate", "Expiry"],
];

function toneFor(status: string | null): BadgeTone {
  if (status === "pass" || status === "cleared") return "success";
  if (status === "fail" || status === "rejected") return "danger";
  if (status === "warning" || status === "conditional_pass" || status === "processing") return "warning";
  return "neutral";
}

function applySampleReview(file: FilePayload, payload: Record<string, unknown>): FilePayload {
  const now = new Date().toISOString();
  const id = `sample-${now}`;
  const action = String(payload.action ?? "");
  const note = typeof payload.note === "string" ? payload.note : null;
  const audit = [{ id, event_type: action === "clear" ? "clearance_marked" : action === "reject" ? "clearance_rejected" : action === "note" ? "note_added" : action === "revert_override" ? "override_reverted" : "check_overridden", created_at: now, payload: { actorName: "You" } }, ...file.audit];
  if (action === "note") {
    return { ...file, audit, reviews: [{ id, action: "note", check_code: null, note, created_at: now }, ...file.reviews] };
  }
  if (action === "override") {
    const code = String(payload.checkCode ?? "");
    const status = payload.status as CheckRow["status"];
    return {
      ...file,
      audit,
      reviews: [{ id, action: "override", check_code: code, note, created_at: now }, ...file.reviews],
      checks: file.checks.map((item) => item.code === code ? { ...item, status, source: "human", note } : item),
    };
  }
  if (action === "revert_override") {
    return { ...file, audit, checks: file.checks.map((item) => item.code === payload.checkCode ? { ...item, source: "rules", note: null } : item) };
  }
  if (action === "clear") return { ...file, audit, mandate: { ...file.mandate, status: "cleared" } };
  if (action === "reject") return { ...file, audit, mandate: { ...file.mandate, status: "rejected" } };
  return file;
}

export function DueDiligenceReport({
  clientId,
  mandateId,
  basePath,
  framed = false,
  sampleFile,
  onBack,
}: {
  clientId: string;
  mandateId: string;
  basePath: string;
  framed?: boolean;
  sampleFile?: FilePayload | null;
  onBack?: () => void;
}) {
  const [file, setFile] = useState<FilePayload | null>(sampleFile ?? null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "disabled">(sampleFile ? "ready" : "loading");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("");
  const [overrideCode, setOverrideCode] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<"pass" | "warning" | "fail">("pass");
  const [overrideNote, setOverrideNote] = useState("");
  const [uploadType, setUploadType] = useState<DocumentType>("national_id");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [waited, setWaited] = useState(false);
  const [preview, setPreview] = useState<{ name: string; url: string; contentType: string } | null>(null);

  const load = useCallback(async () => {
    if (sampleFile) return;
    const response = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}`, { cache: "no-store" });
    if (response.status === 404) {
      const body = await response.json().catch(() => null);
      if (body?.error === "Not found" || body?.error === "Mandate not found.") {
        if (body?.error === "Mandate not found.") {
          setError("Mandate not found.");
          setState("error");
          return;
        }
      }
      setState("disabled");
      return;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Could not load the mandate.");
      setState("error");
      return;
    }
    setFile(body as FilePayload);
    setState("ready");
  }, [clientId, mandateId, sampleFile]);

  useEffect(() => {
    if (sampleFile) {
      setFile(sampleFile);
      setState("ready");
      return;
    }
    void load();
  }, [load, sampleFile]);

  useEffect(() => {
    if (file?.mandate.status !== "processing") return;
    const timer = window.setTimeout(() => void load(), 2500);
    return () => window.clearTimeout(timer);
  }, [file?.mandate.status, load]);

  const processing = file?.mandate.status === "processing" || busy === "Reading documents";
  useEffect(() => {
    if (!processing) {
      setWaited(false);
      return;
    }
    const timer = window.setTimeout(() => setWaited(true), 45000);
    return () => window.clearTimeout(timer);
  }, [processing]);

  async function postReview(payload: Record<string, unknown>, pending: string) {
    if (sampleFile) {
      setActionError("");
      setBusy(pending);
      window.setTimeout(() => {
        setFile((current) => current ? applySampleReview(current, payload) : current);
        setBusy("");
        setNote("");
        setDecision("");
        setOverrideNote("");
      }, 350);
      return;
    }
    setActionError("");
    setBusy(pending);
    const response = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    setBusy("");
    if (!response.ok) {
      setActionError(body?.error ?? "Could not save the review.");
      return;
    }
    setNote("");
    setDecision("");
    setOverrideNote("");
    await load();
  }

  async function runAgain() {
    if (sampleFile) {
      setActionError("");
      setBusy("Reading documents");
      window.setTimeout(() => {
        setFile((current) => current ? {
          ...current,
          audit: [{ id: `sample-${Date.now()}`, event_type: "checks_run", created_at: new Date().toISOString(), payload: { actorName: "You" } }, ...current.audit],
        } : current);
        setBusy("");
      }, 700);
      return;
    }
    setActionError("");
    setBusy("Reading documents");
    const response = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/run`, { method: "POST" });
    const body = await response.json().catch(() => null);
    setBusy("");
    if (!response.ok) {
      setActionError(body?.error ?? "The check did not finish.");
      await load();
      return;
    }
    await load();
  }

  async function upload() {
    if (sampleFile) {
      setActionError("This sample does not store uploads.");
      return;
    }
    if (!uploadFile) {
      setActionError("Choose a file first.");
      return;
    }
    setActionError("");
    setBusy("Uploading");
    const body = new FormData();
    body.set("documentType", uploadType);
    body.set("file", uploadFile);
    const response = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/documents`, { method: "POST", body });
    const payload = await response.json().catch(() => null);
    setBusy("");
    if (!response.ok) {
      setActionError(payload?.error ?? "The document was not saved.");
      return;
    }
    setUploadFile(null);
    await load();
  }

  async function download(documentId: string) {
    if (sampleFile) {
      setActionError("This sample has no stored file to open.");
      return null;
    }
    setActionError("");
    const response = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/documents/${documentId}`);
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.url) {
      setActionError(body?.error ?? "The document could not be opened.");
      return null;
    }
    return String(body.url);
  }

  async function openDocument(documentId: string) {
    const url = await download(documentId);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function showPreview(document: FilePayload["documents"][number]) {
    const url = await download(document.id);
    if (!url) return;
    setPreview({ name: document.fileName, url, contentType: document.contentType ?? "" });
  }

  if (state === "loading") {
    return (
      <div className={framed ? reEmbeddedShell : reSalesShell}>
        <ReSkeletonRows rows={5} label="Loading the mandate" />
      </div>
    );
  }
  if (state === "disabled") {
    return (
      <div className={framed ? reEmbeddedShell : reSalesShell}>
        <ReEmptyState framed title="Due diligence is switched off" description="An administrator turns it on after the database migration is applied." />
      </div>
    );
  }
  if (state === "error" || !file) {
    return (
      <div className={framed ? reEmbeddedShell : reSalesShell}>
        <ReErrorState title="Could not load the mandate" description={error} onRetry={() => void load()} />
      </div>
    );
  }

  const report = file.report;
  const identity = file.mandate.identity_result;
  const stillReading = file.mandate.status === "processing" || busy === "Reading documents";
  const headline = file.mandate.status === "cleared"
    ? "Manually approved"
    : file.mandate.status === "rejected"
      ? "Rejected"
      : report
        ? REPORT_STATUS_LABEL[report.status]
        : "Pending";

  return (
    <div className={framed ? reEmbeddedShell : reSalesShell}>
      <RePageHeader
        context={file.mandate.reference}
        title={file.seller?.fullName || "Mandate"}
        description={file.property ? `${file.property.address} · Stand ${file.property.standNumber}, ${file.property.suburb}, ${file.property.city}` : undefined}
        actions={onBack ? (
          <button type="button" onClick={onBack} className="text-[13px] font-medium text-sales-text-secondary underline-offset-2 hover:underline">All mandates</button>
        ) : (
          <Link href={basePath} className="text-[13px] font-medium text-sales-text-secondary underline-offset-2 hover:underline">All mandates</Link>
        )}
      />
      <section className="rounded-[var(--re-radius-card,12px)] border border-sales-border-subtle bg-sales-surface px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <ReStatusBadge label={headline} tone={toneFor(file.mandate.status === "cleared" || file.mandate.status === "rejected" ? file.mandate.status : report?.status ?? null)} />
            <p className="mt-2 max-w-[62ch] text-[14px] leading-snug text-sales-text-primary">
              {stillReading ? "Reading the documents and comparing them with the form. This usually takes under a minute." : report?.summary ?? "Run the check once the documents are on the file."}
            </p>
          </div>
          <p className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] text-sales-text-primary">
            <span className="sr-only">Score </span>
            {report ? report.risk_score : "—"}
            <span className="ml-1 text-[13px] font-medium text-sales-text-secondary">/ 100</span>
          </p>
        </div>
        <p className="mt-2 text-[12px] text-sales-text-muted">80 and above is a pass. 50 to 79 is a conditional pass. Below 50 fails.</p>
        {file.property ? <p className="mt-3 text-[13px] text-sales-text-secondary">{TENURE_LABEL[file.property.tenureType]}{file.property.localAuthority ? ` · ${file.property.localAuthority}` : ""}</p> : null}
        <p className="mt-3 max-w-[68ch] text-[12px] leading-snug text-sales-text-muted">{REPORT_LIMIT}</p>
      </section>

      {file.seller || file.property ? (
        <ReSection id="parties" title="Seller and property">
          <dl className="grid gap-3 px-3 py-3 sm:grid-cols-2">
            {file.seller ? (
              <>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">Seller</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.seller.fullName}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">National ID</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.seller.idNumber}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">Phone</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.seller.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">Email</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.seller.email || "—"}</dd>
                </div>
              </>
            ) : null}
            {file.property ? (
              <>
                <div className="sm:col-span-2">
                  <dt className="text-[12px] text-sales-text-muted">Property</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.property.address}, {file.property.suburb}, {file.property.city}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">Stand</dt>
                  <dd className="text-[14px] text-sales-text-primary">{file.property.standNumber}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-sales-text-muted">Tenure</dt>
                  <dd className="text-[14px] text-sales-text-primary">{TENURE_LABEL[file.property.tenureType]}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </ReSection>
      ) : null}

      <ReSection id="identity" title="Identity verification">
        {!identity ? (
          <p className="px-3 py-3 text-[13px] text-sales-text-secondary">Identity has not been checked yet. Run the check after the National ID and selfie are on the file.</p>
        ) : (
          <div className="flex flex-col gap-2 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ReStatusBadge
                label={identity.decision ? DECISION_LABEL[identity.decision] : identity.status}
                tone={identity.decision === "clear" ? "success" : identity.decision === "fail" || identity.status === "mismatch" ? "danger" : identity.decision === "review" ? "warning" : "neutral"}
              />
              {typeof identity.confidence === "number" ? <span className="text-[13px] text-sales-text-secondary">Confidence {identity.confidence}</span> : null}
            </div>
            <p className="max-w-[68ch] text-[13px] leading-snug text-sales-text-primary">{identity.detail}</p>
            <p className="text-[12px] text-sales-text-muted">
              Face match: {identity.faceMatch === "matched" ? "Matched" : identity.faceMatch === "unmatched" ? "Not matched" : "Not compared"}
              {" · "}
              Liveness: {identity.liveness === "passed" ? "Passed" : identity.liveness === "failed" ? "Failed" : "Not captured"}
              {identity.returnedName ? ` · Name returned: ${identity.returnedName}` : ""}
            </p>
          </div>
        )}
      </ReSection>

      {actionError ? <p role="alert" className="text-[13px] text-sales-danger-fg">{actionError}</p> : null}

      <ReSection id="checks" title="Checklist" count={file.checks.length || undefined}>
        {stillReading ? <p role="status" className="px-3 py-3 text-[13px] text-sales-text-secondary">{waited ? "This is taking longer than usual. Run the check again if the page is still waiting." : "The checklist updates when the read finishes."}</p> : null}
        {!stillReading && file.checks.length === 0 ? <p className="px-3 py-3 text-[13px] text-sales-text-secondary">No checks yet.</p> : null}
        <ul className="divide-y divide-sales-border-subtle">
          {file.checks.map((item) => (
            <li key={item.code} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-sales-text-primary">{item.label}</p>
                <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary">{item.detail}</p>
                {item.source === "human" && typeof item.evidence?.latestEngineStatus === "string" ? (
                  <p className="mt-1 text-[12px] text-sales-text-muted">Latest automated result: {CHECK_STATUS_LABEL[item.evidence.latestEngineStatus as CheckStatus] ?? item.evidence.latestEngineStatus}. This override is still applied.</p>
                ) : null}
              </div>
              <ReStatusBadge label={item.code.startsWith("document_") && item.status !== "pass" && item.status !== "not_applicable" ? "Missing" : CHECK_STATUS_LABEL[item.status]} tone={toneFor(item.status)} />
            </li>
          ))}
        </ul>
      </ReSection>

      {report ? (
        <>
          <ReSection id="comparison" title="What was entered, and what was read">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-[13px]">
                <caption className="sr-only">Entered details compared with the documents</caption>
                <thead>
                  <tr className="border-b border-sales-border-subtle text-sales-text-secondary">
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">On the form</th>
                    <th className="px-3 py-2 font-medium">On the documents</th>
                  </tr>
                </thead>
                <tbody>
                  {report.comparison.map((row) => (
                    <tr key={row.field} className="border-b border-sales-border-subtle align-top">
                      <th className="px-3 py-2 font-medium text-sales-text-primary">{row.field}</th>
                      <td className="px-3 py-2 text-sales-text-primary">{row.entered || "—"}</td>
                      <td className="px-3 py-2 text-sales-text-secondary">
                        {row.documents.length === 0 ? "Not read" : row.documents.map((cell) => `${cell.value} (${cell.fileName})`).join("; ")}
                        {row.documents.length > 0 && !row.consistent ? <span className="mt-1 block text-sales-warning-fg">These values do not all match.</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReSection>
          <ReSection id="missing" title="Missing documents" count={report.missing_documents.length}>
            {report.missing_documents.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-sales-text-secondary">Every required document type is on the file.</p>
            ) : (
              <ul className="px-3 py-3 text-[13px] text-sales-text-primary">
                {report.missing_documents.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </ReSection>
          <ReSection id="red-flags" title="Red flags" count={report.reasons.length}>
            {report.reasons.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-sales-text-secondary">No red flags were recorded on this run.</p>
            ) : (
              <ul className="flex flex-col gap-2 px-3 py-3">
                {report.reasons.map((item) => (
                  <li key={item} className="text-[13px] leading-snug text-sales-text-primary">{item}</li>
                ))}
              </ul>
            )}
          </ReSection>
          <ReSection id="recommendations" title="What to do next">
            <ul className="flex flex-col gap-2 px-3 py-3">
              {report.recommendations.map((item) => (
                <li key={item} className="text-[13px] leading-snug text-sales-text-primary">{item}</li>
              ))}
            </ul>
          </ReSection>
        </>
      ) : null}

      <ReSection id="files" title="Documents" count={file.documents.length}>
        <ul className="divide-y divide-sales-border-subtle">
          {file.documents.map((document) => {
            const extractedLines = EXTRACTED_LABEL.flatMap(([key, label]) => {
              const value = document.extracted?.fields[key];
              if (typeof value !== "string" || !value) return [];
              return [`${label}: ${value}`];
            });
            const restrictions = document.extracted?.fields.restrictions ?? [];
            return (
              <li key={document.id} className="flex flex-col gap-2 px-3 py-3">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-sales-text-primary">{document.fileName}</span>
                    <span className="block text-[12px] text-sales-text-secondary">
                      {DOCUMENT_LABEL[document.documentType] ?? document.documentType}
                      {document.extractionError ? ` · ${document.extractionError}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button type="button" className="re-focus text-[13px] font-medium text-sales-text-primary underline-offset-2 hover:underline" onClick={() => void showPreview(document)}>
                      Preview
                    </button>
                    <button type="button" className="re-focus text-[13px] font-medium text-sales-text-primary underline-offset-2 hover:underline" onClick={() => void openDocument(document.id)}>
                      Open
                    </button>
                  </span>
                </div>
                {extractedLines.length > 0 || restrictions.length > 0 ? (
                  <p className="text-[12px] leading-snug text-sales-text-secondary">
                    {extractedLines.join(" · ")}
                    {restrictions.length > 0 ? `${extractedLines.length > 0 ? " · " : ""}Restrictions: ${restrictions.join("; ")}` : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {preview ? (
          <div className="border-t border-sales-border-subtle px-3 py-3">
            <p className="mb-2 text-[12px] text-sales-text-muted">{preview.name}</p>
            {preview.contentType.startsWith("image/") ? (
              // Signed URLs are temporary and are not known at build time.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.name} className="max-h-80 max-w-full rounded-[8px] border border-sales-border-subtle" />
            ) : (
              <a className="text-[13px] font-medium text-sales-text-primary underline-offset-2 hover:underline" href={preview.url} target="_blank" rel="noreferrer">Open the file</a>
            )}
          </div>
        ) : null}
        {file.mandate.status !== "cleared" && !stillReading ? (
          <div className="grid gap-2 border-t border-sales-border-subtle px-3 py-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-center">
            <label>
              <span className={acqLabelClass}>Add a document</span>
              <select className={acqFieldClass} value={uploadType} onChange={(event) => setUploadType(event.target.value as DocumentType)}>
                {Object.entries(DOCUMENT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="re-focus mt-5 block text-[13px]" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            <Button type="button" variant="secondary" className="mt-5" loading={busy === "Uploading"} disabled={busy !== ""} onClick={() => void upload()}>Upload</Button>
          </div>
        ) : null}
      </ReSection>

      <ReSection id="review" title="Agent review" description="Overrides stay in place the next time the check runs, until you revert them.">
        <div className="flex flex-col gap-4 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" loading={busy === "Reading documents"} disabled={busy !== "" || file.mandate.status === "cleared" || (stillReading && !waited)} onClick={() => void runAgain()}>
              Run the check again
            </Button>
          </div>
          <label>
            <span className={acqLabelClass}>Note</span>
            <textarea className={`${acqFieldClass} min-h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <Button type="button" variant="secondary" disabled={busy !== "" || note.trim().length < 2} onClick={() => void postReview({ action: "note", note }, "Saving")}>Save note</Button>
          {(file.reviews ?? []).length > 0 ? (
            <ul className="flex flex-col gap-2">
              {file.reviews.map((review) => (
                <li key={review.id} className="text-[13px] leading-snug text-sales-text-secondary">
                  <span className="font-medium text-sales-text-primary">{review.action.split("_").join(" ")}</span>
                  {review.note ? ` · ${review.note}` : ""}
                  <span className="mt-0.5 block text-[12px] text-sales-text-muted">{new Date(review.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              <span className={acqLabelClass}>Override a check</span>
              <select className={acqFieldClass} value={overrideCode} onChange={(event) => setOverrideCode(event.target.value)}>
                <option value="">Choose a check</option>
                {file.checks.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className={acqLabelClass}>New result</span>
              <select className={acqFieldClass} value={overrideStatus} onChange={(event) => setOverrideStatus(event.target.value as "pass" | "warning" | "fail")}>
                <option value="pass">Pass</option>
                <option value="warning">Needs attention</option>
                <option value="fail">Fail</option>
              </select>
            </label>
          </div>
          <label>
            <span className={acqLabelClass}>Why this override</span>
            <textarea className={`${acqFieldClass} min-h-20 py-2`} value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy !== "" || !overrideCode || overrideNote.trim().length < 8} onClick={() => void postReview({ action: "override", checkCode: overrideCode, status: overrideStatus, note: overrideNote }, "Saving")}>
              Save override
            </Button>
            <Button type="button" variant="ghost" disabled={busy !== "" || !overrideCode} onClick={() => void postReview({ action: "revert_override", checkCode: overrideCode }, "Saving")}>
              Revert override
            </Button>
          </div>
          <label>
            <span className={acqLabelClass}>Final decision</span>
            <textarea className={`${acqFieldClass} min-h-20 py-2`} value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="Why this file is cleared or rejected" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy !== "" || decision.trim().length < 8 || file.mandate.status === "cleared" || report?.status === "fail"} onClick={() => void postReview({ action: "clear", note: decision }, "Saving")}>
              Manually approve
            </Button>
            <Button type="button" variant="danger" disabled={busy !== "" || decision.trim().length < 8 || file.mandate.status === "rejected"} onClick={() => void postReview({ action: "reject", note: decision }, "Saving")}>
              Reject
            </Button>
          </div>
          {report?.status === "fail" ? <p className="text-[12px] text-sales-text-secondary">A failed report can be rejected. Clearance stays closed until the failed items are overridden or the documents change.</p> : null}
        </div>
      </ReSection>

      <ReSection id="audit" title="Audit" count={file.audit.length}>
        <ul className="divide-y divide-sales-border-subtle">
          {file.audit.map((event) => (
            <li key={event.id} className="px-3 py-2">
              <p className="text-[13px] font-medium text-sales-text-primary">{EVENT_LABEL[event.event_type] ?? event.event_type}</p>
              <p className="text-[12px] text-sales-text-muted">
                {typeof event.payload?.actorName === "string" ? `${event.payload.actorName} · ` : ""}
                {new Date(event.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </ReSection>
    </div>
  );
}
