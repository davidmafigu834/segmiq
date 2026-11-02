import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canApproveListings, canSubmitListings } from "@/lib/real-estate/listings";
import { getListingPageSettings, saveListingPageSettings } from "@/lib/real-estate/agent-listing-pages/service";
import { CONTACT_POLICIES, ENQUIRY_ROUTINGS } from "@/lib/real-estate/agent-listing-pages/policy";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  agentsMayGenerate: z.boolean().optional(),
  publicAgencyName: z.string().max(80).nullable().optional(),
  showAgentName: z.boolean().optional(),
  showAgentPhoto: z.boolean().optional(),
  showAgentPhone: z.boolean().optional(),
  publicContactPolicy: z.enum(CONTACT_POLICIES).optional(),
  enquiryRouting: z.enum(ENQUIRY_ROUTINGS).optional(),
  catalogueUrl: z.string().max(500).nullable().optional(),
  verifiedWebsite: z.string().max(500).nullable().optional(),
  attributionWindowDays: z.number().int().min(7).max(90).optional(),
  maxCampaignLinks: z.number().int().min(1).max(20).optional(),
});

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  if (!canSubmitListings(guard.session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  const result = await getListingPageSettings(createAdminClient(), params.clientId);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  if (!canApproveListings(guard.session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const patch = { ...parsed.data };
  if (parsed.data.publicAgencyName !== undefined) patch.publicAgencyName = parsed.data.publicAgencyName?.trim() || null;
  if (parsed.data.catalogueUrl !== undefined) patch.catalogueUrl = parsed.data.catalogueUrl?.trim() || null;
  if (parsed.data.verifiedWebsite !== undefined) patch.verifiedWebsite = parsed.data.verifiedWebsite?.trim() || null;
  const result = await saveListingPageSettings(createAdminClient(), params.clientId, patch);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}
