"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ProjectPdfDownloadButtonProps = {
  pdfDownloadUrl: string;
  pdfDirectUrl: string | null;
  fileName: string;
  className?: string;
};

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function ProjectPdfDownloadButton({
  pdfDownloadUrl,
  pdfDirectUrl,
  fileName,
  className,
}: ProjectPdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);

    try {
      if (pdfDirectUrl) {
        window.location.assign(pdfDirectUrl);
        return;
      }

      const res = await fetch(pdfDownloadUrl);
      if (!res.ok) throw new Error("PDF download failed");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (isIosDevice()) {
        window.location.assign(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      window.location.assign(pdfDirectUrl ?? pdfDownloadUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={loading}
      className={className}
    >
      <Download size={13} aria-hidden />
      {loading ? "Preparing…" : "Download PDF"}
    </button>
  );
}
