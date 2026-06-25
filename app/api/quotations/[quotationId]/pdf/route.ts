import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { buildQuotationPdfData } from "@/lib/quotations/build-pdf-data";
import { renderQuotationPdf } from "@/lib/quotations/quotation-pdf";

export const dynamic = "force-dynamic";

/** Render the current quotation to a PDF on demand (preview / download). */
export async function GET(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const data = await buildQuotationPdfData(supabase, params.quotationId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderQuotationPdf(data);
  const filename = `quotation-${data.quoteNumber || "draft"}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
