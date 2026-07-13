import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";

export const dynamic = "force-dynamic";

/** Public quotation PDF — used by WhatsApp document links and customer downloads. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("id, status, quote_number")
    .eq("public_token", params.token)
    .maybeSingle();

  if (!quote || quote.status === "draft") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfData = await buildQuotationPdfData(supabase, quote.id as string);
  if (!pdfData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderQuotationPdf(pdfData);
  const filename = `quotation-${(quote.quote_number as string | null) || "quote"}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
