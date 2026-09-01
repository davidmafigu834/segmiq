"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  uploadCompanyDocument,
  type UploadFileState,
} from "@/lib/documents/client-upload";

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
      setQueue((prev) => [
        ...prev,
        { id, file, status: forceUpload ? "uploading" : "uploading" },
      ]);

      const result = await uploadCompanyDocument(clientId, file, { forceUpload });

      if (!result.ok && result.code === "DUPLICATE_FILE" && result.duplicate) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "duplicate",
                  duplicateOf: result.duplicate,
                }
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
          item.id === id
            ? { ...item, status: "processing", documentId: result.documentId }
            : item
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
          "cursor-pointer rounded-lg border border-dashed transition-colors",
          compact ? "px-4 py-6" : "px-6 py-10",
          dragOver
            ? "border-lime-400/60 bg-lime-400/5"
            : "border-zinc-700 bg-zinc-950/40 hover:border-zinc-600"
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
          <Upload className="h-5 w-5 text-zinc-500" strokeWidth={1.5} />
          <p className="text-sm text-zinc-300">
            {compact ? "Drop files or click to upload" : "Drag and drop files here"}
          </p>
          <p className="text-xs text-zinc-500">PDF, Office, images · up to 50MB</p>
        </div>
      </div>

      {queue.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-zinc-200">{item.file.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                {item.status === "uploading"
                  ? "Uploading…"
                  : item.status === "processing"
                    ? "Processing"
                    : item.status === "ready"
                      ? "Ready"
                      : item.status === "duplicate"
                        ? "Duplicate"
                        : item.status === "failed"
                          ? "Failed"
                          : "Pending"}
              </span>
              {item.status === "duplicate" && item.duplicateOf ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-lime-400 hover:underline"
                  onClick={() => void processFile(item.file, true)}
                >
                  Upload anyway
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
