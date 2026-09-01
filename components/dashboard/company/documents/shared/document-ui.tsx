"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formatDocumentDate } from "@/lib/documents/format";
import type { DocumentListItem } from "@/lib/documents/list-service";
import { DocumentLifecycleBadge, DocumentProcessingBadge, DocumentTypeBadge } from "./document-badges";
import { Button, EmptyState, Skeleton } from "@/components/sales/ui";

export function DocumentSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-sales-text-primary">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] text-sales-text-secondary">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DocumentThumbnail({
  mimeType,
  className,
}: {
  mimeType?: string | null;
  className?: string;
}) {
  const Icon =
    mimeType?.startsWith("image/") ? ImageIcon : mimeType?.includes("sheet") || mimeType?.includes("excel")
      ? FileSpreadsheet
      : FileText;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface-subtle",
        className ?? "h-10 w-10"
      )}
    >
      <Icon size={18} strokeWidth={1.6} className="text-sales-text-muted" />
    </div>
  );
}

export function DocumentSourceCitation({
  title,
  page,
  clause,
  href,
  onOpen,
  excerpt,
}: {
  title: string;
  page?: number | null;
  clause?: string | null;
  href?: string;
  onOpen?: () => void;
  excerpt?: string | null;
}) {
  const location = [clause ? `Clause ${clause}` : null, page ? `Page ${page}` : null]
    .filter(Boolean)
    .join(" · ");

  const inner = (
    <div className="flex items-start gap-3 rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3.5 py-3 transition-colors hover:border-sales-border-strong hover:bg-sales-surface-hover">
      <DocumentThumbnail className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-sales-text-primary">{title}</p>
        {location ? <p className="mt-0.5 text-[12px] text-sales-text-muted">{location}</p> : null}
        {excerpt ? (
          <p className="mt-1.5 line-clamp-2 text-[12px] italic text-sales-text-secondary">
            &ldquo;{excerpt}&rdquo;
          </p>
        ) : null}
      </div>
      <ArrowRight size={14} className="mt-1 shrink-0 text-sales-text-muted" />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

export function SmartCollectionTile({
  label,
  count,
  hint,
  active,
  onClick,
}: {
  label: string;
  count: number;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[10px] border px-3.5 py-3 text-left transition-colors",
        active
          ? "border-sales-brand-border bg-sales-brand-soft"
          : "border-sales-border bg-sales-surface hover:border-sales-border-strong hover:bg-sales-surface-hover"
      )}
    >
      <p className="text-[12px] font-medium text-sales-text-secondary">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-sales-text-primary">
        {count}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-sales-text-muted">{hint}</p> : null}
    </button>
  );
}

export function DocumentAttentionRow({
  title,
  subtitle,
  meta,
  tone = "warning",
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  tone?: "warning" | "danger" | "info";
  actionLabel: string;
  onAction?: () => void;
  href?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-sales-danger/25 bg-sales-danger-soft"
      : tone === "info"
        ? "border-sales-info/20 bg-sales-info-soft"
        : "border-sales-warning/25 bg-sales-warning-soft";

  const action = href ? (
    <Link href={href} className="text-[12px] font-medium text-sales-brand-fg hover:underline">
      {actionLabel}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onAction}
      className="text-[12px] font-medium text-sales-brand-fg hover:underline"
    >
      {actionLabel}
    </button>
  );

  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-[10px] border px-4 py-3", toneClass)}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-primary">{title}</p>
        {subtitle ? <p className="mt-0.5 truncate text-[12px] text-sales-text-secondary">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-[11px] text-sales-text-muted">{meta}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DocumentRowLink({
  doc,
  showSnippet,
}: {
  doc: DocumentListItem;
  showSnippet?: boolean;
}) {
  return (
    <Link
      href={`/client/documents/${doc.id}`}
      className="group flex items-center gap-3 rounded-[10px] border border-transparent px-2 py-2.5 transition-colors hover:border-sales-border hover:bg-sales-surface-hover"
    >
      <DocumentThumbnail mimeType={doc.mime_type} className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-sales-text-primary group-hover:text-sales-brand-fg">
          {doc.title}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">{doc.original_file_name}</p>
        {showSnippet && doc.searchSnippet ? (
          <p className="mt-1 line-clamp-2 text-[12px] text-sales-text-secondary">
            {doc.searchSnippet}
            {doc.searchPageNumber ? ` · Page ${doc.searchPageNumber}` : ""}
          </p>
        ) : null}
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <DocumentTypeBadge label={doc.document_type?.label} />
        <div className="mt-1.5 flex justify-end gap-1.5">
          <DocumentLifecycleBadge status={doc.lifecycle_status} />
        </div>
      </div>
      <div className="hidden shrink-0 text-[12px] text-sales-text-muted md:block">
        {formatDocumentDate(doc.updated_at)}
      </div>
    </Link>
  );
}

export function DocumentsEmptyState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<FileText size={24} strokeWidth={1.5} className="text-sales-text-muted" />}
      title="Your company documents will live here"
      description="Upload contracts, proposals, policies and other records. SegmiQ can classify them, connect them to CRM records and help your team understand what's inside."
      action={
        onUpload ? (
          <Button variant="primary" size="md" onClick={onUpload}>
            Upload document
          </Button>
        ) : undefined
      }
    />
  );
}

export function DocumentsDisabledState() {
  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-6 py-16 text-center">
      <AlertCircle className="mx-auto text-sales-text-muted" size={28} strokeWidth={1.5} />
      <h1 className="mt-4 text-[20px] font-semibold text-sales-text-primary">Documents</h1>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-sales-text-secondary">
        SegmiQ Documents is not enabled for this company yet. A SegmiQ administrator can enable it from
        client Settings → Advanced.
      </p>
    </div>
  );
}

export function DocumentIntelligenceLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-sales-text-muted">
      <Sparkles size={12} strokeWidth={1.8} className="text-sales-brand-fg" />
      Document intelligence
    </span>
  );
}

export function DocumentTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-11 w-11 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
