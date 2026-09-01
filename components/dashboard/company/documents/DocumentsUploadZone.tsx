"use client";

import { useCallback, useRef, useState } from "react";
import { Check, FileText, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formatDocumentBytes } from "@/lib/documents/format";
import {
  uploadCompanyDocument,
  type UploadFileState,
} from "@/lib/documents/client-upload";
import { Badge, Button } from "@/components/sales/ui";

function statusLabel(status: UploadFileState["status"]) {
  switch (status) {
    case "uploading":
      return "Uploading";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "duplicate":
      return "Possible duplicate";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

export function DocumentsUploadZone({
  clientId,
  onUploaded,
  className,
  compact,
}: {
  clientId: string;
  onUploaded?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<UploadFileState[]>([]);

  const processFile = useCallback(
    async (file: File, forceUpload = false) => {
      const id = crypto.randomUUID();
      setQueue((prev) => [...prev, { id, file, status: "uploading" }]);

      const result = await uploadCompanyDocument(clientId, file, { forceUpload });

      if (!result.ok && result.code === "DUPLICATE_FILE" && result.duplicate) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "duplicate", duplicateOf: result.duplicate }
              : item
          )
        );
        return;
      }

      if (!result.ok) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: "failed", error: result.error } : item
          )
        );
        return;
      }

      setQueue((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "processing", documentId: result.documentId } : item
        )
      );
      onUploaded?.();
    },
    [clientId, onUploaded]
  );

  const onFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => void processFile(file));
    },
    [processFile]
  );

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-[12px] border border-dashed transition-colors",
          compact ? "px-4 py-8" : "px-6 py-12",
          dragOver
            ? "border-sales-brand-border bg-sales-brand-soft"
            : "border-sales-border bg-sales-surface-subtle hover:border-sales-border-strong"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-5 w-5 text-sales-text-muted" strokeWidth={1.5} />
          <p className="text-[14px] font-medium text-sales-text-primary">
            {compact ? "Drop files or choose files" : "Drop files here"}
          </p>
          <p className="text-[12px] text-sales-text-muted">PDF, DOCX, XLSX, images and supported files</p>
        </div>
      </div>

      {queue.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="rounded-[10px] border border-sales-border bg-sales-surface px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <FileText size={18} className="mt-0.5 shrink-0 text-sales-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-medium text-sales-text-primary">{item.file.name}</p>
                    <Badge
                      tone={
                        item.status === "failed"
                          ? "danger"
                          : item.status === "duplicate"
                            ? "warning"
                            : item.status === "processing"
                              ? "info"
                              : "neutral"
                      }
                      size="sm"
                      appearance="soft"
                    >
                      {item.status === "uploading" ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" />
                          Uploading
                        </span>
                      ) : (
                        statusLabel(item.status)
                      )}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-sales-text-muted">{formatDocumentBytes(item.file.size)}</p>
                  {item.status === "duplicate" && item.duplicateOf ? (
                    <div className="mt-3 rounded-[8px] border border-sales-warning/25 bg-sales-warning-soft px-3 py-2.5">
                      <p className="text-[12px] font-medium text-sales-warning-fg">Possible duplicate</p>
                      <p className="mt-1 text-[12px] text-sales-text-secondary">
                        Identical to: {item.duplicateOf.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.duplicateOf.documentId ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `/client/documents/${item.duplicateOf!.documentId}`;
                            }}
                          >
                            Open existing
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            void processFile(item.file, true);
                          }}
                        >
                          Upload anyway
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {item.status === "failed" && item.error ? (
                    <p className="mt-2 text-[12px] text-sales-danger-fg">{item.error}</p>
                  ) : null}
                  {item.status === "processing" ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-[12px] text-sales-text-muted">
                      <Check size={12} className="text-sales-success-fg" />
                      Stored · SegmiQ is analyzing
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
