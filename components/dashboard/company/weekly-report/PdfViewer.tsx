"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Printer,
} from "lucide-react";
import { IconButton } from "@/components/sales/ui";
import { pdfUrl } from "./format";

export function PdfViewer({
  reportId,
  available,
}: {
  reportId: string;
  available: boolean;
}) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const src = pdfUrl(reportId, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!available) {
    return (
      <div className="rounded-[10px] border border-sales-border-subtle px-5 py-8">
        <p className="text-[15px] font-medium text-sales-text-primary">PDF still being prepared</p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          The interactive report is available. The portable document will appear here when storage finishes.
        </p>
      </div>
    );
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-[90] flex flex-col bg-sales-bg" : "mt-4 flex flex-col"}>
      <div className="flex flex-wrap items-center gap-1 border-b border-sales-border-subtle bg-sales-surface px-3 py-2">
        <IconButton aria-label="Zoom out" size="sm" icon={<Minus size={14} />} onClick={() => setZoom((z) => Math.max(70, z - 10))} />
        <span className="min-w-[3rem] text-center text-[12px] tabular-nums text-sales-text-muted">{zoom}%</span>
        <IconButton aria-label="Zoom in" size="sm" icon={<Plus size={14} />} onClick={() => setZoom((z) => Math.min(160, z + 10))} />
        <IconButton aria-label="Fit width" size="sm" icon={<span className="text-[10px] font-semibold">W</span>} onClick={() => setZoom(100)} />
        <IconButton aria-label="Fit page" size="sm" icon={<span className="text-[10px] font-semibold">P</span>} onClick={() => setZoom(75)} />
        <span className="mx-1 h-4 w-px bg-sales-border-subtle" aria-hidden />
        <IconButton
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          size="sm"
          icon={fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          onClick={() => setFullscreen((v) => !v)}
        />
        <IconButton
          aria-label="Print"
          size="sm"
          icon={<Printer size={14} />}
          onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
        />
        <a
          href={pdfUrl(reportId)}
          className="ml-auto inline-flex h-8 items-center gap-1 px-2 text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
        >
          <Download size={14} strokeWidth={1.8} aria-hidden />
          Download
        </a>
      </div>
      <div className="flex gap-2 border-b border-sales-border-subtle px-3 py-2 layout:hidden">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] border border-sales-border-subtle text-[13px] font-medium text-sales-text-primary"
        >
          Open PDF
        </a>
        <a
          href={pdfUrl(reportId)}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] bg-sales-brand text-[13px] font-semibold text-[var(--sales-ink)]"
        >
          Download
        </a>
      </div>
      <div className="weekly-report-pdf-canvas min-h-[70vh] flex-1 overflow-auto p-4">
        <div className="mx-auto overflow-hidden rounded-[4px] shadow-sales-card" style={{ width: `${zoom}%` }}>
          <iframe title="Weekly sales performance PDF" src={src} className="h-[78vh] w-full bg-white" />
        </div>
      </div>
    </div>
  );
}
