import { Badge, type BadgeTone } from "@/components/sales/ui";
import { lifecycleStatusLabel, processingStatusLabel } from "@/lib/documents/format";

export function lifecycleStatusTone(status: string): BadgeTone {
  switch (status) {
    case "SIGNED":
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "neutral";
    case "EXPIRED":
    case "SUPERSEDED":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function processingStatusTone(status: string): BadgeTone {
  switch (status) {
    case "READY":
      return "success";
    case "NEEDS_REVIEW":
      return "warning";
    case "FAILED":
      return "danger";
    case "QUEUED":
    case "EXTRACTING":
    case "ANALYZING":
    case "INDEXING":
    case "UPLOADED":
      return "info";
    default:
      return "neutral";
  }
}

export function DocumentLifecycleBadge({ status }: { status: string }) {
  return (
    <Badge tone={lifecycleStatusTone(status)} size="sm" appearance="soft">
      {lifecycleStatusLabel(status)}
    </Badge>
  );
}

export function DocumentProcessingBadge({ status }: { status: string }) {
  return (
    <Badge tone={processingStatusTone(status)} size="sm" appearance="soft">
      {processingStatusLabel(status)}
    </Badge>
  );
}

export function DocumentTypeBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-[13px] text-sales-text-muted">—</span>;
  return (
    <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">
      {label}
    </span>
  );
}
