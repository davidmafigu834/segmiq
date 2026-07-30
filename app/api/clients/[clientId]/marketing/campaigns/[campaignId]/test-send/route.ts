import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { sendCampaignTest } from "@/lib/marketing/campaign-send";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().min(8),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; campaignId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const result = await sendCampaignTest({
    campaignId: params.campaignId,
    testPhone: parsed.data.phone,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
