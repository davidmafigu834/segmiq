import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactMatchesListing, canManageListings, type BuyerMatchContact } from "@/lib/real-estate/helpers";
import {
  canApproveListings,
  canSubmitListings,
  listingWriteSchema,
} from "@/lib/real-estate/listings";
import { assertComplianceProgressAllowed } from "@/lib/real-estate/compliance-service";

export const dynamic = "force-dynamic";

const patchSchema = listingWriteSchema;

export async function GET(
  req: Request,
  { params }: { params: { clientId: string; listingId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const supabase = createAdminClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: contacts } = await supabase
    .from("contacts")
    .select(
      "id, name, phone, email, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, interested_listing_ids"
    )
    .eq("client_id", params.clientId);

  const matches = ((contacts ?? []) as (BuyerMatchContact & { interested_listing_ids?: unknown })[])
    .filter((c) => contactMatchesListing(c, listing))
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      buyer_budget_min: c.buyer_budget_min,
      buyer_budget_max: c.buyer_budget_max,
      buyer_bedrooms_wanted: c.buyer_bedrooms_wanted,
      buyer_area_preference: c.buyer_area_preference,
    }));

  return NextResponse.json({ listing, matches });
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; listingId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSubmitListings(session.role)) {
    return NextResponse.json({ error: "Listing edits are limited to the agency team" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("listings")
    .select("id, agent_id, approval_status")
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const manager = canApproveListings(session.role);
  if (!manager) {
    const own = existing.agent_id === session.userId;
    const open = existing.approval_status === "draft" || existing.approval_status === "pending_approval";
    if (!own || !open) {
      return NextResponse.json(
        { error: "Agents can only edit their own draft or pending listings" },
        { status: 403 }
      );
    }
  }

  const body = parsed.data;
  if (!manager && (body.approval_status === "approved" || body.approval_status === "rejected")) {
    return NextResponse.json({ error: "Only managers can approve listings" }, { status: 403 });
  }
  if (body.status === "sold" || body.status === "let" || body.status === "rented") {
    const gate = await assertComplianceProgressAllowed({
      clientId: params.clientId,
      listingId: params.listingId,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message, code: gate.code }, { status: 409 });
    }
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  for (const key of Object.keys(body) as (keyof typeof body)[]) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (typeof body.address === "string") update.address = body.address.trim() || null;
  if (typeof body.suburb === "string") update.suburb = body.suburb.trim() || null;
  if (typeof body.description === "string") update.description = body.description.trim() || null;
  if (typeof body.external_reference === "string") {
    update.external_reference = body.external_reference.trim() || null;
  }
  if (body.approval_status === "approved") {
    update.approved_at = now;
    update.approved_by = session.userId;
    update.rejection_reason = null;
  } else if (body.approval_status === "pending_approval") {
    update.submitted_for_approval_at = now;
  } else if (body.approval_status === "rejected") {
    update.approved_at = null;
    update.approved_by = session.userId;
  }

  const { data, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: { clientId: string; listingId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageListings(session.role)) {
    return NextResponse.json({ error: "Listing edits are limited to managers" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", params.listingId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
