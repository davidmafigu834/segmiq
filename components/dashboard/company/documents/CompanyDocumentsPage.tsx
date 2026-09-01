"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formatDocumentDate, processingStatusLabel, lifecycleStatusLabel } from "@/lib/documents/format";
import type { DocumentListItem } from "@/lib/documents/list-service";
import type { DocumentsHomeSummary } from "@/lib/documents/list-service";
import type { DocumentTypeRow } from "@/lib/documents/types";
import { DocumentsUploadZone } from "./DocumentsUploadZone";
import { Button } from "@/components/sales/ui";

export function CompanyDocumentsPage({
  clientId,
  initialDocuments,
  initialTotal,
  summary,
  enabled,
}: {
  clientId: string;
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
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(searchParams.get("upload") === "1");

  const activeCollection = searchParams.get("collection");

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("limit", "25");
      if (search.trim() && !params.get("q")) params.set("q", search.trim());

      const res = await fetch(`/api/clients/${clientId}/company-documents?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { documents: DocumentListItem[]; total: number };
      setDocuments(data.documents ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [clientId, search, searchParams]);

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
    const items: Array<{ label: string; count: number; filter: string }> = [];
    if (summary.attention.needsReview > 0) {
      items.push({
        label: "need review",
        count: summary.attention.needsReview,
        filter: "NEEDS_REVIEW",
      });
    }
    if (summary.attention.failed > 0) {
      items.push({
        label: "failed analysis",
        count: summary.attention.failed,
        filter: "FAILED",
      });
    }
    if (summary.attention.processing > 0) {
      items.push({
        label: "processing",
        count: summary.attention.processing,
        filter: "PROCESSING",
      });
    }
    return items;
  }, [summary.attention]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">Documents</h1>
        <p className="mt-3 text-sm text-zinc-400">
          SegmiQ Documents is not enabled for this company yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
      <header className="border-b border-zinc-800/80 px-4 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Documents</h1>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Find anything your company has agreed, shared or documented.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="md" onClick={() => setShowUpload((v) => !v)}>
              {showUpload ? "Hide upload" : "Upload"}
            </Button>
            <Link href="/client/documents/categories">
              <Button variant="secondary" size="md">
                Categories
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              strokeWidth={1.5}
            />
            <input
              type="search"
              placeholder="Ask SegmiQ about your documents… (search by title or filename)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refreshList();
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-lime-400/40 focus:outline-none"
            />
          </div>
          <Button variant="primary" size="md" onClick={() => void refreshList()} disabled={loading}>
            Search
          </Button>
        </div>

        {showUpload ? (
          <div className="mt-4">
            <DocumentsUploadZone
              clientId={clientId}
              compact
              onUploaded={() => {
                void refreshList();
                router.refresh();
              }}
            />
          </div>
        ) : null}
      </header>

      {attentionItems.length > 0 ? (
        <section className="border-b border-zinc-800/80 px-4 py-3 md:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Needs attention</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {attentionItems.map((item) => (
              <button
                key={item.filter}
                type="button"
                onClick={() => {
                  if (item.filter === "PROCESSING") {
                    setFilter("processingStatus", "PROCESSING");
                  } else {
                    setFilter("processingStatus", item.filter);
                  }
                }}
                className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-200/90 hover:border-amber-500/40"
              >
                {item.count} {item.label}
              </button>
            ))}
            <Link
              href="/client/documents/attention"
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              View all
            </Link>
          </div>
        </section>
      ) : null}

      <section className="border-b border-zinc-800/80 px-4 py-4 md:px-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Collections</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {summary.collections
            .filter((c) => !["recent", "needs_attention"].includes(c.id))
            .map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => {
                  setFilter("collection", activeCollection === col.id ? null : col.id);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  activeCollection === col.id
                    ? "border-lime-400/40 bg-lime-400/5"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                )}
              >
                <p className="text-xs text-zinc-500">{col.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{col.count}</p>
              </button>
            ))}
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-300">
            Recent documents
            <span className="ml-2 text-zinc-600">({total})</span>
          </h2>
          {(activeCollection || searchParams.get("processingStatus") || search) && (
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-lime-300"
              onClick={() => {
                setSearch("");
                router.push("/client/documents");
                setDocuments(initialDocuments);
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 py-16 text-center">
            <FileText className="mx-auto h-8 w-8 text-zinc-700" strokeWidth={1.25} />
            <p className="mt-3 text-sm text-zinc-500">No documents match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">Document</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Type</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Status</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-zinc-900/80 hover:bg-zinc-950/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/client/documents/${doc.id}`}
                        className="font-medium text-white hover:text-lime-300"
                      >
                        {doc.title}
                      </Link>
                      <div className="text-xs text-zinc-500">{doc.original_file_name}</div>
                      {doc.searchSnippet ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                          {doc.searchSnippet}
                          {doc.searchPageNumber ? ` · Page ${doc.searchPageNumber}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-400 md:table-cell">
                      {doc.document_type?.label ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-zinc-400">{lifecycleStatusLabel(doc.lifecycle_status)}</span>
                      <span className="mx-1 text-zinc-700">·</span>
                      <span className="text-zinc-500">{processingStatusLabel(doc.processing_status)}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatDocumentDate(doc.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
