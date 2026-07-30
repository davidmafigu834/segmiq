import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { getMarketingSettings, upsertMarketingSettings } from "@/lib/marketing/settings";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const settings = await getMarketingSettings(params.clientId);
  return NextResponse.json({ settings });
}

const updateSchema = z.object({
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  timezone: z.string().optional(),
  max_messages_per_contact_per_week: z.number().int().min(1).max(7).optional(),
  approval_threshold: z.number().int().min(1).optional(),
  duplicate_campaign_days: z.number().int().min(1).max(90).optional(),
  auto_pause_opt_out_rate: z.number().min(0.01).max(1).optional(),
  estimated_cost_per_message_usd: z.number().min(0).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const settings = await upsertMarketingSettings(params.clientId, parsed.data);
  return NextResponse.json({ settings });
}
