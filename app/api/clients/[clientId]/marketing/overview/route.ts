import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMarketingOverview } from "@/lib/marketing/overview";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const overview = await fetchMarketingOverview(params.clientId);
  return NextResponse.json({ overview });
}
