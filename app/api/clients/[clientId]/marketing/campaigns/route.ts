import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_CAMPAIGN_STATS } from "@/lib/marketing/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data: campaigns, error } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: campaigns ?? [] });
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.enum([
    "generate_sales",
    "reactivate_leads",
    "promote_offer",
    "upsell_customers",
    "request_referrals",
    "announce_product",
    "invite_event",
    "follow_up_quotations",
  ]),
  audience_segment_id: z.string().uuid(),
  template_name: z.string().min(1),
  template_language: z.string().default("en"),
  template_variables: z.record(z.string()).default({}),
  template_components: z.array(z.record(z.unknown())).default([]),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (g.session.role !== "CLIENT_MANAGER" && g.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const status = parsed.data.scheduled_at ? "scheduled" : "draft";

  const { data: campaign, error } = await supabase
    .from("whatsapp_campaigns")
    .insert({
      client_id: params.clientId,
      name: parsed.data.name.trim(),
      objective: parsed.data.objective,
      audience_segment_id: parsed.data.audience_segment_id,
      template_name: parsed.data.template_name,
      template_language: parsed.data.template_language,
      template_variables: parsed.data.template_variables,
      template_components: parsed.data.template_components,
      status,
      scheduled_at: parsed.data.scheduled_at ?? null,
      created_by: g.session.userId,
      stats: EMPTY_CAMPAIGN_STATS,
    })
    .select("*")
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create campaign" },
      { status: 500 }
    );
  }

  return NextResponse.json({ campaign });
}
