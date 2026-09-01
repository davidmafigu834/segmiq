"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Upload } from "lucide-react";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import {
  ActiveFiltersBar,
  Button,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableScroll,
  DataTableTd,
  DataTableTh,
  DataTableToolbar,
  DataTableToolbarGroup,
  DataTableWorkspace,
  FilterPill,
  MenuSelect,
  SearchInput,
  Skeleton,
} from "@/components/sales/ui";
import { formatDocumentDate, processingStatusLabel } from "@/lib/documents/format";
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
  const urlQ = searchParams.get("q") ?? "";
  const [listSearch, setListSearch] = useState(urlQ);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "1");

  const activeCollection = searchParams.get("collection");
  const activeProcessing = searchParams.get("processingStatus");
  const activeType = searchParams.get("documentTypeId");

  useEffect(() => {
    setListSearch(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = listSearch.trim();
      if (trimmed === urlQ) return;
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      router.push(`/client/documents?${params.toString()}`);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [listSearch, urlQ, searchParams, router]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", "25");
      const res = await fetch(`/api/clients/${clientId}/company-documents?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { documents: DocumentListItem[]; total: number };
      setDocuments(data.documents ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [clientId, searchParams]);

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

  const activeFilterChips = useMemo(() => {
    const chips: Array<{
      key: string;
      label: string;
      value: string;
      clear: () => void;
    }> = [];

    if (activeCollection) {
      const collection =
        collections.find((c) => c.id === activeCollection) ??
        summary.collections.find((c) => c.id === activeCollection);
      chips.push({
        key: "collection",
        label: "Collection",
        value: collection?.label ?? activeCollection,
        clear: () => setFilter("collection", null),
      });
    }
    if (activeType) {
      const type = types.find((t) => t.id === activeType);
      chips.push({
        key: "type",
        label: "Type",
        value: type?.label ?? "Document type",
        clear: () => setFilter("documentTypeId", null),
      });
    }
    if (activeProcessing) {
      chips.push({
        key: "status",
        label: "Status",
        value: processingStatusLabel(activeProcessing),
        clear: () => setFilter("processingStatus", null),
      });
    }
    if (urlQ.trim()) {
      chips.push({
        key: "q",
        label: "Search",
        value: urlQ.trim(),
        clear: () => {
          setListSearch("");
          setFilter("q", null);
        },
      });
    }
    return chips;
  }, [
    activeCollection,
    activeProcessing,
    activeType,
    collections,
    summary.collections,
    types,
    urlQ,
    setFilter,
  ]);

  const clearAllFilters = useCallback(() => {
    setListSearch("");
    router.push("/client/documents");
  }, [router]);

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
            title="All documents"
            subtitle={`${total} document${total === 1 ? "" : "s"} in this view`}
          />

          <DataTableWorkspace className="overflow-hidden rounded-[14px] border border-sales-border bg-sales-surface">
            <DataTableToolbar className="border-b border-sales-border-subtle px-4 py-3 sm:px-5">
              <DataTableToolbarGroup className="min-w-0 flex-1">
                <SearchInput
                  value={listSearch}
                  onChange={setListSearch}
                  placeholder="Search by title or filename…"
                  className="min-w-0 w-full sm:max-w-[320px]"
                />
              </DataTableToolbarGroup>
              <DataTableToolbarGroup align="end" className="flex-wrap">
                <MenuSelect
                  value={activeType ?? "all"}
                  onChange={(value) =>
                    setFilter("documentTypeId", value === "all" ? null : value)
                  }
                  aria-label="Document type"
                  options={[
                    { value: "all", label: "All types" },
                    ...types.map((t) => ({ value: t.id, label: t.label })),
                  ]}
                />
                <MenuSelect
                  value={activeProcessing ?? "all"}
                  onChange={(value) =>
                    setFilter("processingStatus", value === "all" ? null : value)
                  }
                  aria-label="Processing status"
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "READY", label: "Ready" },
                    { value: "NEEDS_REVIEW", label: "Needs review" },
                    { value: "FAILED", label: "Failed" },
                    { value: "PROCESSING", label: "Processing" },
                  ]}
                />
              </DataTableToolbarGroup>
            </DataTableToolbar>

            {activeFilterChips.length > 0 ? (
              <ActiveFiltersBar
                className="border-b border-sales-border-subtle px-4 py-2.5 sm:px-5"
                onClearAll={clearAllFilters}
              >
                {activeFilterChips.map((chip) => (
                  <FilterPill
                    key={chip.key}
                    label={chip.label}
                    value={chip.value}
                    onRemove={chip.clear}
                  />
                ))}
              </ActiveFiltersBar>
            ) : null}

            {loading ? (
              <div className="p-4 sm:p-5">
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
              <div className="p-6">
                <DocumentsEmptyState onUpload={() => setShowUpload(true)} />
              </div>
            ) : (
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
            )}
          </DataTableWorkspace>
        </section>
      </div>
    </CommercialModulePage>
  );
}
