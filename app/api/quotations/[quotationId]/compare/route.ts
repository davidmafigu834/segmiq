import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageQuotation } from "@/lib/quotations/quote-access";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import { compareQuotationVersions } from "@/lib/quotations/compare-versions";
import type { QuotationLineItemInput } from "@/types";

export async function GET(req: Request, { params }: { params: { quotationId: string } }) {
  const access = await canManageQuotation(params.quotationId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const otherId = new URL(req.url).searchParams.get("other");
  if (!otherId) return NextResponse.json({ error: "other version required" }, { status: 400 });

  const otherAccess = await canManageQuotation(otherId, req);
  if (!otherAccess.allowed) {
    return NextResponse.json({ error: otherAccess.reason }, { status: otherAccess.status });
  }
  if (otherAccess.clientId !== access.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const [a, b] = await Promise.all([
    loadQuotationWithItems(supabase, otherId),
    loadQuotationWithItems(supabase, params.quotationId),
  ]);
  if (!a || !b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const diffs = compareQuotationVersions(
    {
      revision: Number(a.revision_number) || 1,
      items: (a.items as QuotationLineItemInput[]) ?? [],
      total: Number(a.total) || 0,
      discountPercent: Number(a.discount_percent) || 0,
      paymentTerms: (a.payment_terms_label as string | null) ?? null,
      validUntil: (a.valid_until as string | null) ?? null,
      taxRate: Number(a.tax_rate) || 0,
    },
    {
      revision: Number(b.revision_number) || 1,
      items: (b.items as QuotationLineItemInput[]) ?? [],
      total: Number(b.total) || 0,
      discountPercent: Number(b.discount_percent) || 0,
      paymentTerms: (b.payment_terms_label as string | null) ?? null,
      validUntil: (b.valid_until as string | null) ?? null,
      taxRate: Number(b.tax_rate) || 0,
    }
  );
  return NextResponse.json({ diffs });
}
