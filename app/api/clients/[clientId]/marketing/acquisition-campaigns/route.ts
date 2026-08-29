import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  listAcquisitionCampaigns,
  upsertAcquisitionCampaign,
} from "@/lib/real-estate/marketing-service";
import { RE_CAMPAIGN_PLATFORMS } from "@/lib/real-estate/marketing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  platform: z.enum(RE_CAMPAIGN_PLATFORMS).optional(),
  external_campaign_id: z.string().max(200).nullable().optional(),
  form_id: z.string().max(200).nullable().optional(),
  listing_id: z.string().uuid().nullable().optional(),
  default_agent_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "ended"]).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  reported_spend: z.number().nonnegative().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
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
  const campaigns = await listAcquisitionCampaigns(params.clientId);
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const result = await upsertAcquisitionCampaign({
    clientId: params.clientId,
    actor: { id: session.userId, role: session.role, clientId: session.clientId ?? null },
    name: b.name,
    platform: b.platform,
    externalCampaignId: b.external_campaign_id,
    formId: b.form_id,
    listingId: b.listing_id,
    defaultAgentId: b.default_agent_id,
    status: b.status,
    startDate: b.start_date,
    endDate: b.end_date,
    reportedSpend: b.reported_spend,
    notes: b.notes,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ campaign: result.campaign });
}
