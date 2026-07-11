"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ProjectPdfDownloadButtonProps = {
  pdfDownloadUrl: string;
  fileName: string;
  className?: string;
};

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function ProjectPdfDownloadButton({
  pdfDownloadUrl,
  fileName,
  className,
}: ProjectPdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(pdfDownloadUrl);
      if (!res.ok) throw new Error("PDF download failed");

      // iOS Web Share opens a sheet where Print is prominent — skip it.
      // After the PDF is generated/cached, navigate directly so Safari handles
      // the attachment response (Save to Files via the viewer share button).
      if (isIosDevice()) {
        window.location.assign(pdfDownloadUrl);
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
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
      window.location.assign(pdfDownloadUrl);
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
