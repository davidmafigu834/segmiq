"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ClipboardList,
  Download,
  FileText,
  GitCompare,
  History,
  LayoutList,
  Link2,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  activityActionLabel,
  activityMetadataSummary,
  categoryActionLabel,
  formatDocumentBytes,
  formatDocumentDate,
} from "@/lib/documents/format";
import {
  formatFactValue,
} from "@/lib/documents/intelligence/profiles";
import type { DocumentClassificationAuditSummary } from "@/lib/documents/get-document-detail-data";
import type { DocumentIntelligenceBundle } from "@/lib/documents/intelligence/types";
import type { DocumentAskCitation } from "@/lib/documents/retrieval/types";
import {
  DocumentDatesPanel,
  DocumentKeyTermsPanel,
  DocumentObligationsPanel,
  DocumentSummaryCard,
} from "@/components/dashboard/company/documents/DocumentIntelligencePanels";
import { DocumentRelatedRecordsPanel } from "@/components/dashboard/company/documents/DocumentRelatedRecordsPanel";
import { AskDocumentsComposer } from "@/components/dashboard/company/documents/shared/AskDocumentsComposer";
import { DocumentCompareVersionsSheet } from "@/components/dashboard/company/documents/shared/DocumentCompareVersionsSheet";
import { DocumentPdfViewer } from "@/components/dashboard/company/documents/shared/DocumentPdfViewer";
import { DocumentProcessingTimeline } from "@/components/dashboard/company/documents/shared/DocumentProcessingTimeline";
import {
  DocumentIntelligenceLabel,
  DocumentSectionHeader,
  DocumentThumbnail,
} from "@/components/dashboard/company/documents/shared/document-ui";
import {
  DocumentLifecycleBadge,
  DocumentProcessingBadge,
} from "@/components/dashboard/company/documents/shared/document-badges";
import type { EnrichedDocumentEntityLink } from "@/lib/documents/linking/types";
import type { DocumentActivityRow } from "@/lib/documents/list-service";
import type {
  DocumentAccessPolicyRow,
  DocumentRow,
  DocumentVersionRow,
} from "@/lib/documents/types";
import { Badge, Button } from "@/components/sales/ui";

export type DocumentDetailSection =
  | "overview"
  | "key_terms"
  | "obligations"
  | "dates"
  | "related"
  | "document"
  | "versions"
  | "activity";

const SECTIONS: Array<{
  id: DocumentDetailSection;
  label: string;
  icon: typeof LayoutList;
}> = [
  { id: "overview", label: "Overview", icon: LayoutList },
  { id: "key_terms", label: "Key Terms", icon: Scale },
  { id: "obligations", label: "Obligations", icon: ClipboardList },
  { id: "dates", label: "Dates", icon: Calendar },
  { id: "related", label: "Related Records", icon: Link2 },
  { id: "document", label: "Document", icon: FileText },
  { id: "versions", label: "Versions", icon: GitCompare },
  { id: "activity", label: "Activity", icon: History },
];

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand" | "warning";
}) {
  return (
    <div className="bg-sales-surface px-3.5 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[15px] font-semibold text-sales-text-primary",
          tone === "brand" && "text-sales-brand-fg",
          tone === "warning" && "text-sales-warning-fg"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function DocumentDetailWorkspace({
  clientId,
  document,
  version,
  typeLabel,
  versions,
  activity,
  policy,
  tags = [],
  classification = null,
  categoryName = null,
  intelligence,
  links,
  canCorrectIntelligence = false,
  canEditLinks = false,
  initialSection = "overview",
  initialPage,
  initialHighlight,
}: {
  clientId: string;
  document: DocumentRow;
  version: DocumentVersionRow | null;
  typeLabel: string | null;
  versions: DocumentVersionRow[];
  activity: DocumentActivityRow[];
  policy: DocumentAccessPolicyRow | null;
  content: {
    plain_text: string | null;
    char_count: number;
    word_count: number;
    tables: unknown;
    extractor_version: string;
    extracted_at: string;
  } | null;
  tags?: string[];
  classification?: DocumentClassificationAuditSummary | null;
  categoryName?: string | null;
  intelligence: DocumentIntelligenceBundle;
  links: EnrichedDocumentEntityLink[];
  canCorrectIntelligence?: boolean;
  canEditLinks?: boolean;
  initialSection?: DocumentDetailSection;
  initialPage?: number;
  initialHighlight?: string;
}) {
  const [section, setSection] = useState<DocumentDetailSection>(initialSection);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [pdfPage, setPdfPage] = useState<number | null>(initialPage ?? null);
  const [pdfHighlight, setPdfHighlight] = useState<string | null>(initialHighlight ?? null);
  const [comparePair, setComparePair] = useState<{
    fromId: string;
    toId: string;
    fromLabel: string;
    toLabel: string;
  } | null>(null);

  const isProcessing = ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING", "UPLOADED"].includes(
    document.processing_status
  );

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => window.location.reload(), 5000);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  const handleReprocess = useCallback(async () => {
    setReprocessing(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/company-documents/${document.id}/reprocess`,
        { method: "POST" }
      );
      if (res.ok) window.location.reload();
    } finally {
      setReprocessing(false);
    }
  }, [clientId, document.id]);

  const downloadHref = `/api/clients/${clientId}/company-documents/${document.id}/download`;

  const loadPreview = useCallback(async () => {
    if (!version) return;
    const res = await fetch(downloadHref);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) setPreviewUrl(data.url as string);
  }, [downloadHref, version]);

  useEffect(() => {
    if (section === "document" && !previewUrl) void loadPreview();
  }, [section, previewUrl, loadPreview]);

  useEffect(() => {
    if (initialPage) setPdfPage(initialPage);
    if (initialHighlight) setPdfHighlight(initialHighlight);
  }, [initialPage, initialHighlight]);

  const handleCitationOpen = useCallback((citation: DocumentAskCitation) => {
    setSection("document");
    if (citation.pageNumber) setPdfPage(citation.pageNumber);
    if (citation.excerpt) setPdfHighlight(citation.excerpt);
  }, []);

  const isPdf = version?.mime_type === "application/pdf";
  const isImage = version?.mime_type?.startsWith("image/");

  const metaLine = [typeLabel, categoryName].filter(Boolean).join(" · ");
  const primaryCustomer = links.find((l) => l.entity_type === "CUSTOMER" && l.confirmed);

  const summaryMetrics = useMemo(() => {
    const contractValue = intelligence.keyTerms.find((f) => f.fact_type === "CONTRACT_VALUE");
    const expiryRow = intelligence.importantDates.find((d) => d.date_type === "EXPIRY");
    const activeObligations = intelligence.obligations.filter((o) => o.status !== "CANCELLED").length;
    const currentVersion = versions.find((v) => v.is_current);

    return {
      contractValue: contractValue ? formatFactValue(contractValue.value_json) : null,
      expiry: expiryRow?.date_value
        ? formatDocumentDate(expiryRow.date_value)
        : expiryRow?.date_text ?? null,
      obligations: activeObligations > 0 ? String(activeObligations) : null,
      related: links.length > 0 ? String(links.length) : null,
      version: currentVersion ? `V${currentVersion.version_number}` : null,
    };
  }, [intelligence, links.length, versions]);

  return (
    <div className="space-y-4">
      <Link
        href="/client/documents"
        className="inline-flex text-[12px] font-medium text-sales-text-muted hover:text-sales-brand-fg"
      >
        ← Documents
      </Link>

      <div className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
        <div className="grid gap-5 border-b border-sales-border-subtle p-4 sm:p-5 lg:grid-cols-[132px_minmax(0,1.15fr)_minmax(240px,0.95fr)] lg:items-start">
          <DocumentThumbnail mimeType={version?.mime_type} className="mx-auto h-[132px] w-[132px] lg:mx-0" />

          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[30px]">
              {document.title}
            </h1>
            <p className="mt-1 truncate text-[13px] text-sales-text-muted">{document.original_file_name}</p>
            {metaLine ? <p className="mt-1 text-[13px] text-sales-text-secondary">{metaLine}</p> : null}
            {primaryCustomer ? (
              <p className="mt-1 text-[13px] text-sales-text-secondary">{primaryCustomer.label}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DocumentLifecycleBadge status={document.lifecycle_status} />
              <DocumentProcessingBadge status={document.processing_status} />
              {policy?.classification === "CONFIDENTIAL" ? (
                <Badge tone="warning" size="sm" appearance="soft">
                  Confidential
                </Badge>
              ) : null}
            </div>
            {version ? (
              <p className="mt-2 text-[12px] text-sales-text-muted">
                Uploaded {formatDocumentDate(document.created_at)}
                {version.version_number ? ` · V${version.version_number}` : ""}
                {" · "}
                {formatDocumentBytes(Number(version.size_bytes))}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-sales-border bg-sales-border">
            <SummaryCell label="Contract value" value={summaryMetrics.contractValue ?? "—"} tone="brand" />
            <SummaryCell label="Expires" value={summaryMetrics.expiry ?? "—"} />
            <SummaryCell
              label="Active obligations"
              value={summaryMetrics.obligations ?? "—"}
              tone={summaryMetrics.obligations ? "warning" : undefined}
            />
            <SummaryCell label="Related records" value={summaryMetrics.related ?? "—"} />
            <SummaryCell label="Current version" value={summaryMetrics.version ?? "—"} />
            <div className="col-span-2 flex flex-wrap justify-end gap-2 bg-sales-surface px-3 py-2.5">
              <a href={downloadHref}>
                <Button variant="secondary" size="md">
                  <Download size={15} className="mr-1.5" />
                  Download
                </Button>
              </a>
              {(document.processing_status === "FAILED" ||
                document.processing_status === "NEEDS_REVIEW") && (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={reprocessing}
                  onClick={() => void handleReprocess()}
                >
                  {reprocessing ? "Retrying…" : "Retry analysis"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-[520px] lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-sales-border-subtle p-2 lg:sticky lg:top-0 lg:max-h-[calc(100vh-12rem)] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={cn(
                    "relative flex min-h-10 shrink-0 items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] transition-colors",
                    active
                      ? "bg-sales-brand-soft font-medium text-sales-text-primary"
                      : "font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                  )}
                >
                  {active ? (
                    <span className="absolute bottom-2 left-0 top-2 hidden w-[3px] rounded-full bg-sales-brand lg:block" />
                  ) : null}
                  <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 p-4 sm:p-6">
            {section === "overview" && (
              <div className="space-y-6">
                <DocumentSectionHeader
                  title="Overview"
                  subtitle="Understand the document without reading every page."
                />
                {isProcessing ? (
                  <div className="rounded-[12px] border border-sales-border bg-sales-surface-subtle p-4">
                    <p className="mb-3 text-[13px] font-medium text-sales-text-primary">
                      Processing timeline
                    </p>
                    <DocumentProcessingTimeline status={document.processing_status} />
                  </div>
                ) : null}
                {version?.extraction_error ? (
                  <div className="rounded-[10px] border border-sales-warning/25 bg-sales-warning-soft px-4 py-3 text-[13px] text-sales-warning-fg">
                    {version.extraction_error}
                  </div>
                ) : null}
                {classification ? (
                  <div className="rounded-[12px] border border-sales-border bg-sales-surface-subtle p-4">
                    <DocumentIntelligenceLabel />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {typeLabel ? (
                        <Badge tone="neutral" size="sm" appearance="soft">
                          {typeLabel}
                        </Badge>
                      ) : null}
                      {categoryName ? (
                        <Badge tone="brand" size="sm" appearance="soft">
                          {categoryName}
                        </Badge>
                      ) : classification.suggested_category_name ? (
                        <Badge tone="warning" size="sm" appearance="soft">
                          Suggested: {classification.suggested_category_name}
                        </Badge>
                      ) : null}
                      {tags.map((tag) => (
                        <Badge key={tag} tone="neutral" size="sm" appearance="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-sales-text-muted">
                      {categoryActionLabel(classification.category_action)}
                      {classification.category_action === "AUTO_CREATED" ? " · Created by SegmiQ" : ""}
                    </p>
                  </div>
                ) : null}
                <DocumentSummaryCard intelligence={intelligence.intelligence} />
                {document.processing_status === "FAILED" ? (
                  <div className="rounded-[12px] border border-dashed border-sales-border px-6 py-10 text-center">
                    <p className="text-[14px] text-sales-text-secondary">Document intelligence unavailable</p>
                    <p className="mt-1 text-[13px] text-sales-text-muted">
                      The original file is safe, but SegmiQ couldn&apos;t analyze it.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      className="mt-4"
                      disabled={reprocessing}
                      onClick={() => void handleReprocess()}
                    >
                      Retry analysis
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {section === "key_terms" && (
              <div className="space-y-4">
                <DocumentSectionHeader
                  title="Key Terms"
                  subtitle="Important commercial and contractual terms identified in this document."
                />
                <DocumentKeyTermsPanel
                  clientId={clientId}
                  documentId={document.id}
                  keyTerms={intelligence.keyTerms}
                  canCorrect={canCorrectIntelligence}
                />
              </div>
            )}

            {section === "obligations" && (
              <div className="space-y-4">
                <DocumentSectionHeader
                  title="Obligations"
                  subtitle="What each party has committed to do."
                />
                <DocumentObligationsPanel
                  clientId={clientId}
                  documentId={document.id}
                  obligations={intelligence.obligations}
                />
              </div>
            )}

            {section === "dates" && (
              <div className="space-y-4">
                <DocumentSectionHeader title="Important dates" subtitle="Chronological dates detected in this document." />
                <DocumentDatesPanel importantDates={intelligence.importantDates} />
              </div>
            )}

            {section === "related" && (
              <div className="space-y-4">
                <DocumentSectionHeader title="Related records" subtitle="CRM relationships for this document." />
                <DocumentRelatedRecordsPanel
                  clientId={clientId}
                  documentId={document.id}
                  links={links}
                  canEdit={canEditLinks}
                />
              </div>
            )}

            {section === "document" && (
              <div className="space-y-4">
                <DocumentSectionHeader title="Document" subtitle="View the original file and ask questions about it." />
                <AskDocumentsComposer
                  clientId={clientId}
                  documentId={document.id}
                  onCitationOpen={handleCitationOpen}
                />
                {isPdf && previewUrl ? (
                  <DocumentPdfViewer
                    title={document.title}
                    previewUrl={previewUrl}
                    page={pdfPage}
                    highlight={pdfHighlight}
                  />
                ) : isImage && previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={document.title} className="max-h-[72vh] w-full object-contain p-4" />
                  ) : !version ? (
                    <p className="p-6 text-[13px] text-sales-text-muted">No file version available.</p>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <p className="text-[14px] text-sales-text-secondary">
                        Preview is not available for this file type.
                      </p>
                      <a href={downloadHref} className="mt-3 inline-block text-[13px] font-medium text-sales-brand-fg hover:underline">
                        Download original
                      </a>
                    </div>
                  )}
              </div>
            )}

            {section === "versions" && (
              <div className="space-y-4">
                <DocumentSectionHeader title="Version history" subtitle="All versions of this document." />
                <div className="overflow-hidden rounded-[12px] border border-sales-border">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-sales-border-subtle bg-sales-surface-subtle text-[11px] uppercase tracking-wide text-sales-text-muted">
                        <th className="px-4 py-2.5 font-medium">Version</th>
                        <th className="px-4 py-2.5 font-medium">File</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Uploaded</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} className="border-b border-sales-border-subtle last:border-0">
                          <td className="px-4 py-3 font-medium text-sales-text-primary">
                            V{v.version_number}
                            {v.is_current ? (
                              <Badge tone="brand" size="sm" appearance="soft" className="ml-2">
                                Current
                              </Badge>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sales-text-secondary">{v.original_file_name}</td>
                          <td className="px-4 py-3">
                            <DocumentProcessingBadge status={v.processing_status} />
                          </td>
                          <td className="px-4 py-3 text-sales-text-muted">{formatDocumentDate(v.uploaded_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {!v.is_current ? (
                                <button
                                  type="button"
                                  className="text-[12px] font-medium text-sales-brand-fg hover:underline"
                                  onClick={() => {
                                    const current = versions.find((ver) => ver.is_current);
                                    if (!current) return;
                                    setComparePair({
                                      fromId: v.id,
                                      toId: current.id,
                                      fromLabel: `V${v.version_number}`,
                                      toLabel: `V${current.version_number}`,
                                    });
                                  }}
                                >
                                  Compare
                                </button>
                              ) : null}
                              <a
                                href={`${downloadHref}?versionId=${v.id}`}
                                className="text-[12px] font-medium text-sales-brand-fg hover:underline"
                              >
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === "activity" && (
              <div className="space-y-4">
                <DocumentSectionHeader title="Activity" subtitle="Recent actions on this document." />
                <ul className="space-y-2">
                  {activity.length === 0 ? (
                    <li className="text-[13px] text-sales-text-muted">No activity recorded yet.</li>
                  ) : (
                    activity.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-4 rounded-[10px] border border-sales-border px-4 py-3"
                      >
                        <div>
                          <p className="text-[14px] font-medium text-sales-text-primary">
                            {activityActionLabel(row.action)}
                          </p>
                          {row.metadata && Object.keys(row.metadata).length > 0 ? (
                            <p className="mt-1 text-[12px] text-sales-text-muted">
                              {activityMetadataSummary(row.metadata as Record<string, unknown>)}
                            </p>
                          ) : null}
                        </div>
                        <time className="shrink-0 text-[12px] text-sales-text-muted">
                          {formatDocumentDate(row.created_at)}
                        </time>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {comparePair ? (
        <DocumentCompareVersionsSheet
          clientId={clientId}
          documentId={document.id}
          fromVersionId={comparePair.fromId}
          toVersionId={comparePair.toId}
          fromLabel={comparePair.fromLabel}
          toLabel={comparePair.toLabel}
          onClose={() => setComparePair(null)}
        />
      ) : null}
    </div>
  );
}
