import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveCampaign } from "@/lib/marketing/campaign-send";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; campaignId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await approveCampaign(params.campaignId, g.session.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", params.campaignId)
    .maybeSingle();

  return NextResponse.json({ campaign, approved: true });
}
