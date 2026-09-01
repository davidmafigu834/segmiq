"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Upload } from "lucide-react";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import {
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableScroll,
  DataTableTd,
  DataTableTh,
  DataTableWorkspace,
  SearchInput,
  Select,
  Skeleton,
} from "@/components/sales/ui";
import { formatDocumentDate } from "@/lib/documents/format";
import type { DocumentListItem } from "@/lib/documents/list-service";
import type { DocumentsHomeSummary } from "@/lib/documents/list-service";
import type { DocumentTypeRow } from "@/lib/documents/types";
import type { UserRole } from "@/types";
import { AskDocumentsComposer } from "./shared/AskDocumentsComposer";
import {
  DocumentAttentionRow,
  DocumentSectionHeader,
  DocumentsDisabledState,
  DocumentsEmptyState,
  DocumentThumbnail,
  SmartCollectionTile,
} from "./shared/document-ui";
import {
  DocumentLifecycleBadge,
  DocumentProcessingBadge,
  DocumentTypeBadge,
} from "./shared/document-badges";
import { DocumentsUploadZone } from "./DocumentsUploadZone";

type Chrome = {
  companyName: string;
  companyLogoUrl?: string | null;
  userName: string;
  avatarUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  whatsappBadge?: number;
};

export function CompanyDocumentsPage({
  clientId,
  chrome,
  initialDocuments,
  initialTotal,
  summary,
  types,
  enabled,
}: {
  clientId: string;
  chrome: Chrome;
  initialDocuments: DocumentListItem[];
  initialTotal: number;
  summary: DocumentsHomeSummary;
  types: DocumentTypeRow[];
  enabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState(initialDocuments);
  const [total, setTotal] = useState(initialTotal);
  const [listSearch, setListSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "1");

  const activeCollection = searchParams.get("collection");
  const activeProcessing = searchParams.get("processingStatus");
  const activeType = searchParams.get("documentTypeId");

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", "25");
      if (listSearch.trim()) params.set("q", listSearch.trim());
      const res = await fetch(`/api/clients/${clientId}/company-documents?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { documents: DocumentListItem[]; total: number };
      setDocuments(data.documents ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [clientId, listSearch, searchParams]);

  useEffect(() => {
    void refreshList();
  }, [searchParams.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/client/documents?${params.toString()}`);
    },
    [router, searchParams]
  );

  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      meta?: string;
      tone: "warning" | "danger" | "info";
      actionLabel: string;
      href: string;
    }> = [];
    if (summary.attention.needsReview > 0) {
      items.push({
        id: "review",
        title: "Documents need review",
        subtitle: "Classification or intelligence needs confirmation",
        meta: `${summary.attention.needsReview} document${summary.attention.needsReview === 1 ? "" : "s"}`,
        tone: "warning",
        actionLabel: "Review",
        href: "/client/documents?processingStatus=NEEDS_REVIEW",
      });
    }
    if (summary.attention.failed > 0) {
      items.push({
        id: "failed",
        title: "Analysis failed",
        subtitle: "Original files are stored securely",
        meta: `${summary.attention.failed} document${summary.attention.failed === 1 ? "" : "s"}`,
        tone: "danger",
        actionLabel: "View",
        href: "/client/documents?processingStatus=FAILED",
      });
    }
    if (summary.attention.processing > 0) {
      items.push({
        id: "processing",
        title: "Processing in progress",
        subtitle: "SegmiQ is classifying and understanding new uploads",
        meta: `${summary.attention.processing} active`,
        tone: "info",
        actionLabel: "View",
        href: "/client/documents?processingStatus=PROCESSING",
      });
    }
    return items;
  }, [summary.attention]);

  const collections = summary.collections.filter(
    (c) => !["recent", "needs_attention"].includes(c.id)
  );

  if (!enabled) {
    return (
      <CommercialModulePage
        chrome={chrome}
        breadcrumb="COMPANY / DOCUMENTS"
        title="Documents"
        description="Find anything your company has agreed, shared or documented."
      >
        <DocumentsDisabledState />
      </CommercialModulePage>
    );
  }

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="COMPANY / DOCUMENTS"
      title="Documents"
      description="Find anything your company has agreed, shared or documented."
      primaryAction={
        <Button variant="primary" size="md" onClick={() => setShowUpload((v) => !v)}>
          <Upload size={16} className="mr-1.5" />
          {showUpload ? "Hide upload" : "Upload document"}
        </Button>
      }
      titleActions={
        <div className="flex items-center gap-2">
          <Link href="/client/documents/search">
            <Button variant="secondary" size="md">
              Ask Documents
            </Button>
          </Link>
          <Link href="/client/documents/categories">
            <Button variant="secondary" size="md">
              Categories
            </Button>
          </Link>
          <Link href="/client/documents/attention">
            <Button variant="secondary" size="md">
              Attention
              {summary.attention.total > 0 ? (
                <span className="ml-1.5 rounded-full bg-sales-warning px-1.5 py-0.5 text-[10px] font-semibold text-[#4A2A02]">
                  {summary.attention.total}
                </span>
              ) : null}
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 sm:p-5">
          <AskDocumentsComposer clientId={clientId} />
        </section>

        {showUpload ? (
          <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 sm:p-5">
            <DocumentSectionHeader
              title="Upload documents"
              subtitle="SegmiQ will classify, organize and understand supported documents automatically."
            />
            <DocumentsUploadZone
              clientId={clientId}
              onUploaded={() => {
                void refreshList();
                router.refresh();
              }}
            />
          </section>
        ) : null}

        {attentionItems.length > 0 ? (
          <section>
            <DocumentSectionHeader
              title="Needs attention"
              subtitle="Items that may need review or action."
              action={
                <Link href="/client/documents/attention" className="text-[12px] font-medium text-sales-brand-fg hover:underline">
                  View all
                </Link>
              }
            />
            <div className="grid gap-2 lg:grid-cols-2">
              {attentionItems.map((item) => (
                <DocumentAttentionRow key={item.id} {...item} />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <DocumentSectionHeader title="Smart collections" subtitle="Operational filters across your library." />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {collections.map((col) => (
              <SmartCollectionTile
                key={col.id}
                label={col.label}
                count={col.count}
                active={activeCollection === col.id}
                onClick={() => setFilter("collection", activeCollection === col.id ? null : col.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <DocumentSectionHeader
            title="Recent documents"
            subtitle={`${total} document${total === 1 ? "" : "s"} in this view`}
          />

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <SearchInput
                value={listSearch}
                onChange={setListSearch}
                placeholder="Search documents by title or filename…"
              />
              <Button variant="secondary" size="md" onClick={() => void refreshList()}>
                Search
              </Button>
            </div>
            <Select
              value={activeType ?? ""}
              onChange={(e) => setFilter("documentTypeId", e.target.value || null)}
              className="min-w-[140px]"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select
              value={activeProcessing ?? ""}
              onChange={(e) => setFilter("processingStatus", e.target.value || null)}
              className="min-w-[140px]"
            >
              <option value="">All statuses</option>
              <option value="READY">Ready</option>
              <option value="NEEDS_REVIEW">Needs review</option>
              <option value="FAILED">Failed</option>
              <option value="PROCESSING">Processing</option>
            </Select>
            {(activeCollection || activeProcessing || activeType || listSearch) && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setListSearch("");
                  router.push("/client/documents");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {loading ? (
            <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-11 w-11 rounded-[10px]" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-6">
              <DocumentsEmptyState onUpload={() => setShowUpload(true)} />
            </div>
          ) : (
            <DataTableWorkspace>
              <DataTableScroll>
                <DataTableEl>
                  <DataTableHead>
                    <tr>
                      <DataTableTh>Document</DataTableTh>
                      <DataTableTh className="hidden md:table-cell">Type</DataTableTh>
                      <DataTableTh className="hidden lg:table-cell">Status</DataTableTh>
                      <DataTableTh className="hidden sm:table-cell">Updated</DataTableTh>
                      <DataTableTh className="w-10" />
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {documents.map((doc) => (
                      <DataTableRow key={doc.id}>
                        <DataTableTd>
                          <Link href={`/client/documents/${doc.id}`} className="flex items-center gap-3 group">
                            <DocumentThumbnail className="h-11 w-11" />
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-sales-text-primary group-hover:text-sales-brand-fg">
                                {doc.title}
                              </p>
                              <p className="truncate text-[12px] text-sales-text-muted">
                                {doc.original_file_name}
                              </p>
                              {doc.searchSnippet ? (
                                <p className="mt-1 line-clamp-2 text-[12px] text-sales-text-secondary">
                                  {doc.searchSnippet}
                                  {doc.searchPageNumber ? ` · Page ${doc.searchPageNumber}` : ""}
                                </p>
                              ) : null}
                            </div>
                          </Link>
                        </DataTableTd>
                        <DataTableTd className="hidden md:table-cell">
                          <DocumentTypeBadge label={doc.document_type?.label} />
                        </DataTableTd>
                        <DataTableTd className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1.5">
                            <DocumentLifecycleBadge status={doc.lifecycle_status} />
                            <DocumentProcessingBadge status={doc.processing_status} />
                          </div>
                        </DataTableTd>
                        <DataTableTd className="hidden text-[13px] text-sales-text-secondary sm:table-cell">
                          {formatDocumentDate(doc.updated_at)}
                        </DataTableTd>
                        <DataTableTd>
                          <Link
                            href={`/client/documents/${doc.id}`}
                            className="inline-flex text-sales-text-muted hover:text-sales-brand-fg"
                            aria-label="Open document"
                          >
                            <MoreHorizontal size={16} />
                          </Link>
                        </DataTableTd>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTableEl>
              </DataTableScroll>
            </DataTableWorkspace>
          )}
        </section>
      </div>
    </CommercialModulePage>
  );
}
