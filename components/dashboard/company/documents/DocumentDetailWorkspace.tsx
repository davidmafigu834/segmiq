"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ClipboardList,
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
  lifecycleStatusLabel,
  processingStatusLabel,
} from "@/lib/documents/format";
import type { DocumentClassificationAuditSummary } from "@/lib/documents/get-document-detail-data";
import type { DocumentIntelligenceBundle } from "@/lib/documents/intelligence/types";
import {
  DocumentDatesPanel,
  DocumentKeyTermsPanel,
  DocumentObligationsPanel,
  DocumentSummaryCard,
} from "@/components/dashboard/company/documents/DocumentIntelligencePanels";
import { DocumentRelatedRecordsPanel } from "@/components/dashboard/company/documents/DocumentRelatedRecordsPanel";
import type { EnrichedDocumentEntityLink } from "@/lib/documents/linking/types";
import type { DocumentActivityRow } from "@/lib/documents/list-service";
import type {
  DocumentAccessPolicyRow,
  DocumentRow,
  DocumentVersionRow,
} from "@/lib/documents/types";
import { Button } from "@/components/sales/ui";

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

export function DocumentDetailWorkspace({
  clientId,
  document,
  version,
  typeLabel,
  versions,
  activity,
  policy,
  content,
  tags = [],
  classification = null,
  categoryName = null,
  intelligence,
  links,
  canCorrectIntelligence = false,
  canEditLinks = false,
  initialSection = "overview",
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
}) {
  const [section, setSection] = useState<DocumentDetailSection>(initialSection);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [askQuery, setAskQuery] = useState("");
  const [reprocessing, setReprocessing] = useState(false);

  const isProcessing = ["QUEUED", "EXTRACTING", "ANALYZING", "INDEXING", "UPLOADED"].includes(
    document.processing_status
  );

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => {
      window.location.reload();
    }, 5000);
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

  const isPdf = version?.mime_type === "application/pdf";
  const isImage = version?.mime_type?.startsWith("image/");

  const headerMeta = useMemo(
    () => [
      typeLabel ?? "Document",
      lifecycleStatusLabel(document.lifecycle_status),
      processingStatusLabel(document.processing_status),
    ].join(" · "),
    [typeLabel, document.lifecycle_status, document.processing_status]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a] lg:flex-row">
      <aside className="shrink-0 border-b border-zinc-800 lg:w-52 lg:border-b-0 lg:border-r">
        <div className="px-4 py-4 lg:py-5">
          <Link href="/client/documents" className="text-xs text-zinc-500 hover:text-lime-300">
            ← Documents
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-6">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200"
                )}
              >
                <Icon size={16} strokeWidth={1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-0 flex-1 overflow-auto">
        <header className="border-b border-zinc-800 px-4 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{headerMeta}</p>
              <h1 className="mt-1 text-xl font-semibold text-white">{document.title}</h1>
              <p className="mt-1 text-sm text-zinc-400">{document.original_file_name}</p>
              {version ? (
                <p className="mt-2 text-xs text-zinc-500">
                  V{version.version_number}
                  {version.version_label ? ` · ${version.version_label}` : ""}
                  {" · "}
                  {formatDocumentBytes(Number(version.size_bytes))}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href={downloadHref}>
                <Button variant="secondary" size="md">
                  Download original
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

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="Ask this document…"
              disabled
              title="Document Q&A arrives in a later phase"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-500"
            />
            <Button variant="primary" size="md" disabled>
              Ask
            </Button>
          </div>
        </header>

        <div className="px-4 py-5 md:px-6">
          {section === "overview" && (
            <div className="space-y-4">
              {isProcessing ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400">
                  {processingStatusLabel(document.processing_status)} — understanding this document…
                </div>
              ) : null}
              {version?.extraction_error ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
                  {version.extraction_error}
                </div>
              ) : null}
              {document.description ? (
                <p className="text-sm text-zinc-300">{document.description}</p>
              ) : null}
              {classification ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Classification
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {classification.document_type_code ? (
                      <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200">
                        {typeLabel ?? classification.document_type_code}
                      </span>
                    ) : null}
                    {categoryName ? (
                      <span className="rounded-full border border-lime-500/30 bg-lime-500/10 px-2.5 py-1 text-xs text-lime-200">
                        {categoryName}
                      </span>
                    ) : classification.suggested_category_name ? (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100">
                        Suggested: {classification.suggested_category_name}
                      </span>
                    ) : null}
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    {categoryActionLabel(classification.category_action)}
                    {classification.type_confidence
                      ? ` · Type confidence ${classification.type_confidence.toLowerCase()}`
                      : ""}
                    {classification.category_action === "AUTO_CREATED" ? (
                      <span className="text-lime-400"> · New category was created automatically</span>
                    ) : null}
                  </p>
                  {classification.needs_review ? (
                    <p className="mt-2 text-xs text-amber-200/90">
                      Review the suggested type or category before relying on this classification.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 p-3">
                  <dt className="text-xs text-zinc-500">Lifecycle</dt>
                  <dd className="mt-1 text-sm text-white">
                    {lifecycleStatusLabel(document.lifecycle_status)}
                  </dd>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <dt className="text-xs text-zinc-500">Processing</dt>
                  <dd className="mt-1 text-sm text-white">
                    {processingStatusLabel(document.processing_status)}
                  </dd>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <dt className="text-xs text-zinc-500">Access</dt>
                  <dd className="mt-1 text-sm text-white">
                    {policy?.scope_type?.replace(/_/g, " ") ?? "Company"}
                    {policy?.classification ? ` · ${policy.classification}` : ""}
                  </dd>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <dt className="text-xs text-zinc-500">Uploaded</dt>
                  <dd className="mt-1 text-sm text-white">{formatDocumentDate(document.created_at)}</dd>
                </div>
              </dl>
              {content?.plain_text ? (
                <div className="rounded-lg border border-zinc-800 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Extracted text preview
                  </p>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-zinc-300">
                    {content.plain_text}
                  </p>
                  <p className="mt-2 text-xs text-zinc-600">
                    {content.word_count} words · {content.char_count} characters ·{" "}
                    {content.extractor_version}
                  </p>
                </div>
              ) : !isProcessing && document.processing_status !== "FAILED" ? (
                <DocumentSummaryCard intelligence={intelligence.intelligence} />
              ) : document.processing_status === "FAILED" ? (
                <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-8 text-center">
                  <p className="text-sm text-zinc-400">We couldn&apos;t analyze this document.</p>
                  <Button
                    variant="secondary"
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
            <DocumentKeyTermsPanel
              clientId={clientId}
              documentId={document.id}
              keyTerms={intelligence.keyTerms}
              canCorrect={canCorrectIntelligence}
            />
          )}
          {section === "obligations" && (
            <DocumentObligationsPanel obligations={intelligence.obligations} />
          )}
          {section === "dates" && (
            <DocumentDatesPanel importantDates={intelligence.importantDates} />
          )}
          {section === "related" && (
            <DocumentRelatedRecordsPanel
              clientId={clientId}
              documentId={document.id}
              links={links}
              canEdit={canEditLinks}
            />
          )}

          {section === "document" && (
            <div className="space-y-3">
              {!version ? (
                <p className="text-sm text-zinc-500">No file version available.</p>
              ) : isPdf && previewUrl ? (
                <iframe
                  title={document.title}
                  src={previewUrl}
                  className="h-[70vh] w-full rounded-lg border border-zinc-800 bg-white"
                />
              ) : isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={document.title}
                  className="max-h-[70vh] rounded-lg border border-zinc-800"
                />
              ) : (
                <div className="rounded-lg border border-zinc-800 px-4 py-10 text-center">
                  <p className="text-sm text-zinc-400">
                    Preview is not available for this file type. Download the original to view it.
                  </p>
                  <a href={downloadHref} className="mt-3 inline-block text-sm text-lime-400 hover:underline">
                    Download original
                  </a>
                </div>
              )}
            </div>
          )}

          {section === "versions" && (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                    <th className="px-4 py-2.5">Version</th>
                    <th className="px-4 py-2.5">File</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Uploaded</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-b border-zinc-900">
                      <td className="px-4 py-3 text-white">
                        V{v.version_number}
                        {v.is_current ? (
                          <span className="ml-2 text-xs text-lime-400">Current</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{v.original_file_name}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {processingStatusLabel(v.processing_status)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{formatDocumentDate(v.uploaded_at)}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`${downloadHref}?versionId=${v.id}`}
                          className="text-xs text-lime-400 hover:underline"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === "activity" && (
            <ul className="space-y-2">
              {activity.length === 0 ? (
                <li className="text-sm text-zinc-500">No activity recorded yet.</li>
              ) : (
                activity.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">{activityActionLabel(row.action)}</p>
                      {row.metadata && Object.keys(row.metadata).length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {activityMetadataSummary(row.metadata as Record<string, unknown>)}
                        </p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-zinc-500">
                      {formatDocumentDate(row.created_at)}
                    </time>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
