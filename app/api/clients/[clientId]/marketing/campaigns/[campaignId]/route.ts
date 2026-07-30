import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; campaignId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();

  const [{ data: campaign }, { data: recipients }] = await Promise.all([
    supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", params.campaignId)
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase
      .from("whatsapp_campaign_recipients")
      .select("id, phone, status, skip_reason, sent_at, delivered_at, read_at, replied_at, response_classification, error_message")
      .eq("campaign_id", params.campaignId)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign, recipients: recipients ?? [] });
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["paused", "cancelled"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; campaignId: string } }
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

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name) patch.name = parsed.data.name.trim();
  if (parsed.data.status) patch.status = parsed.data.status;

  const { data: campaign, error } = await supabase
    .from("whatsapp_campaigns")
    .update(patch)
    .eq("id", params.campaignId)
    .eq("client_id", params.clientId)
    .select("*")
    .single();

  if (error || !campaign) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ campaign });
}
