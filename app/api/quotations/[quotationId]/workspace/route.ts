import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { loadQuotationWorkspace } from "@/lib/quotations/workspace-data";

export async function GET(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const supabase = createAdminClient();
  const workspace = await loadQuotationWorkspace(supabase, params.quotationId, {
    role: access.actor.role,
    userId: access.actor.id,
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(workspace);
}
