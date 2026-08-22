import { getPublicBaseUrl } from "@/lib/constants";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";
import { buildQuoteDocumentModel } from "./build-document-model";
import { quotationPdfFilename } from "./filename";
import { isSolarLayout } from "./registry";
import { renderLayoutPdf } from "./residential-premium-solar-pdf";

export async function renderQuotationOutput(
  supabase: Parameters<typeof buildQuoteDocumentModel>[0],
  quotationId: string,
  origin?: string | null
): Promise<{ buffer: Buffer; filename: string } | null> {
  const base = origin?.replace(/\/$/, "") || getPublicBaseUrl();
  const model = await buildQuoteDocumentModel(supabase, quotationId, { origin: base });
  if (model && isSolarLayout(model.layoutKey)) {
    const buffer = await renderLayoutPdf(model);
    return {
      buffer,
      filename: quotationPdfFilename(model.quote.number, model.customer.name),
    };
  }
  const data = await buildQuotationPdfData(supabase, quotationId);
  if (!data) return null;
  const buffer = await renderQuotationPdf(data);
  return {
    buffer,
    filename: quotationPdfFilename(data.quoteNumber, data.customerName),
  };
}
