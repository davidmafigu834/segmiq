import { loadListingPage } from "@/lib/real-estate/listing-read-service";
import { canReadListing, listingReadDto, canAssignListingAgent } from "@/lib/real-estate/listing-access";
import { bearerListingPhotoError } from "@/lib/real-estate/mobile-workflows";
import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  canApproveListings,
  canSubmitListings,
  defaultApprovalForCreate,
  isListingLive,
  listingCreateSchema,
} from "@/lib/real-estate/listings";
import { background } from "@/lib/background";

export const dynamic = "force-dynamic";

const listingBodySchema = listingCreateSchema;

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  if (!canSubmitListings(g.session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "80"), page = Number(url.searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(page) || page < 1 || page > 100000)
    return NextResponse.json({ error: "Invalid pagination", code: "INVALID_REQUEST" }, { status: 400 });
  for (const name of ["min_price", "max_price", "bedrooms"]) {
    if (url.searchParams.has(name) && !Number.isFinite(Number(url.searchParams.get(name))))
      return NextResponse.json({ error: "Invalid numeric filter", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const result = await loadListingPage(supabase, g.session, params.clientId, url, page, limit);
  if (result.error) return NextResponse.json({ error: "Could not load listings", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
  return NextResponse.json({ listings: (result.data ?? []).filter(row => canReadListing(g.session, row)).map(row => listingReadDto(g.session, row, req.headers.has("authorization"))), page, limit, total: result.count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const session = guard.session;
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSubmitListings(session.role)) {
    return NextResponse.json({ error: "You cannot create listings" }, { status: 403 });
  }

  const parsed = listingBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_type")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.business_type !== "real_estate") {
    return NextResponse.json({ error: "Listings are only available for real estate clients" }, { status: 403 });
  }

  const body = parsed.data;
  const mobile = req.headers.has("authorization");
  const photoError = mobile ? bearerListingPhotoError(body.photos, params.clientId, null) : null;
  if (photoError) return NextResponse.json(photoError, { status: 400 });
  if (!canAssignListingAgent(session, body.agent_id)) return NextResponse.json({ error: "Cannot assign another agent", code: "FORBIDDEN" }, { status: 403 });
  if (body.agent_id) {
    const agent = await supabase.from("users").select("id").eq("id", body.agent_id).eq("client_id", params.clientId).eq("is_active", true).maybeSingle();
    if (agent.error) return NextResponse.json({ error: "Agent lookup unavailable", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
    if (!agent.data) return NextResponse.json({ error: "Invalid agent", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const status = body.status ?? "available";
  const now = new Date().toISOString();
  const manager = canApproveListings(session.role);
  let approvalStatus = defaultApprovalForCreate(session.role);
  if (manager && body.approval_status) approvalStatus = body.approval_status;
  if (!manager) approvalStatus = body.approval_status === "draft" ? "draft" : "pending_approval";

  const { data, error } = await supabase
    .from("listings")
    .insert({
      client_id: params.clientId,
      agent_id: body.agent_id ?? (session.role === "SALESPERSON" ? session.userId : null),
      development_id: body.development_id ?? null,
      transaction_type: body.transaction_type,
      status,
      approval_status: approvalStatus,
      submitted_for_approval_at: approvalStatus === "pending_approval" ? now : null,
      approved_at: approvalStatus === "approved" ? now : null,
      approved_by: approvalStatus === "approved" ? session.userId : null,
      price: body.price ?? null,
      bedrooms: body.bedrooms ?? null,
      bathrooms: body.bathrooms ?? null,
      size_sqm: body.size_sqm ?? null,
      address: body.address?.trim() || null,
      suburb: body.suburb?.trim() || null,
      description: body.description?.trim() || null,
      photos: mobile ? [] : (body.photos ?? []),
      mandate_type: body.mandate_type ?? null,
      mandate_expiry_date: body.mandate_expiry_date || null,
      lease_term_months: body.lease_term_months ?? null,
      external_reference: body.external_reference?.trim() || null,
      ...(body.property_category ? { property_category: body.property_category } : {}),
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (body.property_category && (error.code === "42703" || /property_category/.test(error.message))) {
      return NextResponse.json({ error: "Property type needs the final corrections migration. Save without it for now." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Matching on a new live listing creates internal agent notifications only. Customers are
  // contacted by an agent through send-match, never automatically.
  if (data && isListingLive(data)) {
    background("listing-property-match", async () => {
      const { discoverMatchesForListing } = await import("@/lib/real-estate/buyer-sales-service");
      await discoverMatchesForListing({ clientId: params.clientId, listingId: data.id as string });
    });
  }

  const actor = { userId: session.userId, role: session.role, clientId: session.clientId };
  return NextResponse.json({ listing: mobile ? listingReadDto(actor, data, true) : data }, { status: 201 });
}
