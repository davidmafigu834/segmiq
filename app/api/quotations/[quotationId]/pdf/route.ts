import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { renderQuotationOutput } from "@/lib/quotations/layouts/render-output";
import { getPublicBaseUrl } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Render the current quotation to a PDF on demand (preview / download). */
export async function GET(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const origin = new URL(req.url).origin || getPublicBaseUrl();
  const output = await renderQuotationOutput(supabase, params.quotationId, origin);
  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(output.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${output.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
