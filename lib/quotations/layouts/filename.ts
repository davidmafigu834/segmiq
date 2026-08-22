function sanitizePart(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return cleaned.slice(0, 48);
}

export function quotationPdfFilename(quoteNumber: string | null | undefined, customerName: string | null | undefined): string {
  const num = sanitizePart(quoteNumber || "quotation") || "quotation";
  const name = sanitizePart(customerName || "");
  return name ? `${num}-${name}.pdf` : `${num}.pdf`;
}
