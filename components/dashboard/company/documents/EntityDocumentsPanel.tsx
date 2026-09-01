"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button, Skeleton } from "@/components/sales/ui";
import type { DocumentListItem } from "@/lib/documents/list-service";
import { formatDocumentDate } from "@/lib/documents/format";
import { DocumentThumbnail } from "./shared/document-ui";
import { DocumentLifecycleBadge } from "./shared/document-badges";

export function EntityDocumentsPanel({
  clientId,
  entityType,
  entityId,
  entityLabel,
  compact,
}: {
  clientId: string;
  entityType: "CUSTOMER" | "DEAL";
  entityId: string;
  entityLabel?: string;
  compact?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        entityType,
        entityId,
        limit: compact ? "4" : "6",
      });
      const res = await fetch(
        `/api/clients/${clientId}/company-documents/by-entity?${params}`
      );
      const data = (await res.json().catch(() => ({}))) as { documents?: DocumentListItem[] };
      if (!res.ok) {
        setError(true);
        setDocuments([]);
        return;
      }
      setDocuments(data.documents ?? []);
    } catch {
      setError(true);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, entityType, entityId, compact]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewAllHref = `/client/documents?entityType=${entityType}&entityId=${entityId}`;
  const uploadHref = `/client/documents/upload?entityType=${entityType}&entityId=${entityId}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-sales-text-muted" />
          <h3 className="text-[12px] font-semibold text-sales-text-primary">Documents</h3>
        </div>
        <Link
          href={uploadHref}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sales-brand-fg hover:underline"
        >
          <Plus size={12} />
          Upload
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <p className="text-[12px] text-sales-text-muted">Could not load documents.</p>
      ) : !documents.length ? (
        <div className="rounded-[10px] border border-dashed border-sales-border px-3 py-4 text-center">
          <p className="text-[12px] text-sales-text-secondary">
            No documents linked to {entityLabel ?? "this record"} yet.
          </p>
          <Link href={uploadHref}>
            <Button variant="secondary" size="sm" className="mt-2">
              Upload document
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/client/documents/${doc.id}`}
                className="flex items-center gap-2.5 rounded-[9px] border border-transparent px-2 py-2 transition-colors hover:border-sales-border hover:bg-sales-surface-hover"
              >
                <DocumentThumbnail mimeType={doc.mime_type} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-sales-text-primary">{doc.title}</p>
                  <p className="truncate text-[11px] text-sales-text-muted">
                    {doc.document_type?.label ?? "Document"} · {formatDocumentDate(doc.updated_at)}
                  </p>
                </div>
                <DocumentLifecycleBadge status={doc.lifecycle_status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {documents.length > 0 ? (
        <Link
          href={viewAllHref}
          className="mt-2 inline-flex text-[11px] font-medium text-sales-brand-fg hover:underline"
        >
          View all documents →
        </Link>
      ) : null}
    </div>
  );
}
