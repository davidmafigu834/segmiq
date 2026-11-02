import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSubmitListings } from "@/lib/real-estate/listings";
import { generateShareLink, listShareLinks } from "@/lib/real-estate/agent-listing-pages/service";
import type { ShareActor } from "@/lib/real-estate/agent-listing-pages/policy";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  listingId: z.string().uuid(),
  campaignLabel: z.string().max(40).nullable().optional(),
});

function actor(session: { userId: string; role: ShareActor["role"]; clientId: string | null; alsoSells?: boolean }): ShareActor {
  return { userId: session.userId, role: session.role, clientId: session.clientId, alsoSells: session.alsoSells };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  if (!canSubmitListings(guard.session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "40");
  if (!Number.isInteger(page) || page < 1 || page > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "Invalid pagination", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const result = await listShareLinks(createAdminClient(), actor(guard.session), params.clientId, {
    listingId: url.searchParams.get("listingId"),
    status: url.searchParams.get("status"),
    q: url.searchParams.get("q"),
    page,
    limit,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", code: "INVALID_REQUEST" }, { status: 400 });
  const result = await generateShareLink(createAdminClient(), actor(guard.session), params.clientId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result, { status: result.reused ? 200 : 201 });
}
