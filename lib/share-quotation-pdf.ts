/** Share a quotation PDF (not a link) via WhatsApp or the system share sheet. */
export async function shareQuotationPdf(opts: {
  pdfBlob: Blob;
  fileName: string;
  phone: string | null;
  message: string;
}): Promise<{ ok: boolean; error?: string; hint?: string }> {
  const file = new File([opts.pdfBlob], opts.fileName, { type: "application/pdf" });

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const payload: ShareData = { text: opts.message, files: [file] };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return { ok: true };
      }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: opts.message });
        return { ok: true };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, error: "Share cancelled" };
      }
    }
  }

  // Desktop / unsupported: download the PDF and open WhatsApp with text only (no link).
  const url = URL.createObjectURL(opts.pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  a.click();
  URL.revokeObjectURL(url);

  const digits = (opts.phone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(opts.message);
  const waUrl = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");

  return {
    ok: true,
    hint: "PDF downloaded — attach it in WhatsApp before sending.",
  };
}

export async function fetchQuotationPdfBlob(pdfUrl: string): Promise<Blob> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error("Could not download quotation PDF");
  return res.blob();
}
