import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { copyQuotationAsDraft } from "@/lib/quotations/copy-quote";
import { loadQuotationWithItems } from "@/lib/quotations/persist";

const REVISABLE = new Set(["sent", "viewed", "rejected", "expired"]);

export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const { data: source } = await supabase
    .from("quotations")
    .select("id, status, revision_number, superseded_by_id")
    .eq("id", params.quotationId)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.status === "draft") {
    return NextResponse.json({ error: "Draft quotations can be edited directly" }, { status: 400 });
  }
  if (source.status === "accepted") {
    return NextResponse.json({ error: "Accepted quotations cannot be revised" }, { status: 400 });
  }
  if (source.superseded_by_id) {
    return NextResponse.json({ error: "This quotation was already superseded" }, { status: 409 });
  }
  if (!REVISABLE.has(source.status as string)) {
    return NextResponse.json({ error: "This quotation cannot be revised" }, { status: 400 });
  }

  const nextRevision = (Number(source.revision_number) || 1) + 1;
  const copied = await copyQuotationAsDraft(supabase, {
    sourceQuotationId: params.quotationId,
    targetLeadId: access.leadId,
    clientId: access.clientId,
    actor: access.actor,
    parentQuotationId: params.quotationId,
    revisionNumber: nextRevision,
  });
  if (!copied) return NextResponse.json({ error: "Revision failed" }, { status: 500 });

  const full = await loadQuotationWithItems(supabase, copied.id);
  return NextResponse.json({ quotation: full }, { status: 201 });
}
