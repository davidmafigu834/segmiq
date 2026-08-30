import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessClient } from "@/lib/auth/permissions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contactMatchesListing, type BuyerMatchContact } from "@/lib/real-estate/helpers";
import {
  canApproveListings,
  canSubmitListings,
  defaultApprovalForCreate,
  isListingLive,
  listingCreateSchema,
} from "@/lib/real-estate/listings";
import { listingMatchesSearch } from "@/lib/real-estate/matching";
import { notifyPropertyMatch } from "@/lib/real-estate/notifications";
import { background } from "@/lib/background";

export const dynamic = "force-dynamic";

const listingBodySchema = listingCreateSchema;

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const developmentId = url.searchParams.get("development_id");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const suburb = url.searchParams.get("suburb")?.trim().toLowerCase() ?? "";
  const transactionType = url.searchParams.get("transaction_type");
  const minPrice = url.searchParams.get("min_price");
  const maxPrice = url.searchParams.get("max_price");
  const bedrooms = url.searchParams.get("bedrooms");
  const limitRaw = Number(url.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 80;

  const supabase = createAdminClient();
  let query = supabase
    .from("listings")
    .select("*, agent:users!listings_agent_id_fkey(id, name), development:developments(id, name)")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (developmentId) query = query.eq("development_id", developmentId);
  if (transactionType) query = query.eq("transaction_type", transactionType);
  if (suburb) query = query.ilike("suburb", `%${suburb}%`);
  if (minPrice) query = query.gte("price", Number(minPrice));
  if (maxPrice) query = query.lte("price", Number(maxPrice));
  if (bedrooms) query = query.gte("bedrooms", Number(bedrooms));

  const { data, error } = await query;
  if (error) {
    // Fallback without FK embed aliases if PostgREST naming differs
    const fallback = await supabase
      .from("listings")
      .select("*")
      .eq("client_id", params.clientId)
      .order("created_at", { ascending: false });
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    let fallbackListings = fallback.data ?? [];
    fallbackListings = fallbackListings.filter((row) =>
      listingMatchesSearch(row as Parameters<typeof listingMatchesSearch>[0], {
        q: q || undefined,
        suburb: suburb || undefined,
        transactionType:
          (transactionType as "sale" | "rental" | "new_development" | "property_management") ||
          undefined,
        status: status || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
      })
    );
    return NextResponse.json({ listings: fallbackListings.slice(0, limit) });
  }

  let listings = data ?? [];
  if (q) {
    listings = listings.filter((row) =>
      listingMatchesSearch(row as Parameters<typeof listingMatchesSearch>[0], { q })
    );
  }

  return NextResponse.json({ listings });
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      photos: body.photos ?? [],
      mandate_type: body.mandate_type ?? null,
      mandate_expiry_date: body.mandate_expiry_date || null,
      lease_term_months: body.lease_term_months ?? null,
      external_reference: body.external_reference?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Property matching when new available listing is created
  if (data && isListingLive(data)) {
    background("listing-property-match", async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select(
          "id, name, phone, email, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference"
        )
        .eq("client_id", params.clientId);

      const matches = ((contacts ?? []) as BuyerMatchContact[]).filter((c) =>
        contactMatchesListing(c, data)
      );

      for (const match of matches.slice(0, 25)) {
        await notifyPropertyMatch({
          clientId: params.clientId,
          to: match.phone,
          contactName: match.name,
          listing: data,
        });
      }
    });
  }

  return NextResponse.json({ listing: data }, { status: 201 });
}
