import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { copyQuotationAsDraft } from "@/lib/quotations/copy-quote";
import { loadQuotationWithItems } from "@/lib/quotations/persist";

export async function POST(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) return NextResponse.json({ error: access.reason }, { status: access.status });

  const supabase = createAdminClient();
  const copied = await copyQuotationAsDraft(supabase, {
    sourceQuotationId: params.quotationId,
    targetLeadId: access.leadId,
    clientId: access.clientId,
    actor: access.actor,
  });
  if (!copied) return NextResponse.json({ error: "Duplicate failed" }, { status: 500 });

  const full = await loadQuotationWithItems(supabase, copied.id);
  return NextResponse.json({ quotation: full }, { status: 201 });
}
