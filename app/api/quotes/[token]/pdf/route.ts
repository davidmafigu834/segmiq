import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderQuotationOutput } from "@/lib/quotations/layouts/render-output";
import { getPublicBaseUrl } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public quotation PDF — used by WhatsApp document links and customer downloads. */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotations")
    .select("id, status, quote_number")
    .eq("public_token", params.token)
    .maybeSingle();

  if (!quote || quote.status === "draft") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = new URL(req.url).origin || getPublicBaseUrl();
  const output = await renderQuotationOutput(supabase, quote.id as string, origin);
  if (!output) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(output.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${output.filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
