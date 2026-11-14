import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateFunnel } from "@/lib/real-estate/funnels/service";
import { FUNNEL_STATUSES } from "@/lib/real-estate/funnels/policy";

export const dynamic = "force-dynamic";

const schema = z.object({
  html: z.string().max(2_100_000).nullable().optional(),
  status: z.enum(FUNNEL_STATUSES).optional(),
  shareTitle: z.string().max(200).nullable().optional(),
  shareSummary: z.string().max(400).nullable().optional(),
  shareImageUrl: z.string().max(1000).nullable().optional(),
  priceLabel: z.string().max(60).nullable().optional(),
  brief: z.string().max(5000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { funnelId: string } }) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) return NextResponse.json({ error: "Forbidden" }, { status: origin.status });
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!z.string().uuid().safeParse(params.funnelId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again" }, { status: 400 });
  const result = await updateFunnel(createAdminClient(), auth.session.userId, params.funnelId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  const { html: _html, ...funnel } = result.funnel;
  return NextResponse.json({ funnel });
}
