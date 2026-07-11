"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ProjectPdfDownloadButtonProps = {
  pdfDownloadUrl: string;
  fileName: string;
  className?: string;
};

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

      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
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
