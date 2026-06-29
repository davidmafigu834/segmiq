import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProposalAdmin } from "@/lib/proposals/access";
import { buildProposalPdfData } from "@/lib/proposals/build-pdf-data";
import { renderProposalPdf } from "@/lib/proposals/proposal-pdf";

export const dynamic = "force-dynamic";

/** Render the current proposal to a PDF on demand (preview / download). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireProposalAdmin(req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const data = await buildProposalPdfData(supabase, params.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderProposalPdf(data);
  const filename = `proposal-${data.proposalNumber || "draft"}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
