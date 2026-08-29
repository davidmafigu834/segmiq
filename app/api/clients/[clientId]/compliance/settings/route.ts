import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  DEFAULT_COMPLIANCE_SETTINGS,
  parseComplianceSettings,
} from "@/lib/real-estate/compliance";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  require_cdd_after_accepted_offer: z.boolean().optional(),
  require_approval_before_progression: z.boolean().optional(),
  allow_agents_to_start_cdd: z.boolean().optional(),
  restrict_review_to_flagged_users: z.boolean().optional(),
  individual_required_docs: z.array(z.string()).optional(),
  corporate_required_docs: z.array(z.string()).optional(),
});

export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("compliance_settings")
    .eq("id", params.clientId)
    .maybeSingle();
  return NextResponse.json({
    settings: parseComplianceSettings(data?.compliance_settings),
    defaults: DEFAULT_COMPLIANCE_SETTINGS,
  });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("compliance_settings")
    .eq("id", params.clientId)
    .maybeSingle();
  const next = { ...parseComplianceSettings(data?.compliance_settings), ...parsed.data };
  await supabase.from("clients").update({ compliance_settings: next }).eq("id", params.clientId);
  return NextResponse.json({ settings: next });
}
