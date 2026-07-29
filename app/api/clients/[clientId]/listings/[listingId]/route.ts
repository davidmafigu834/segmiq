import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactMatchesListing, type BuyerMatchContact } from "@/lib/real-estate/helpers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  agent_id: z.string().uuid().nullable().optional(),
  development_id: z.string().uuid().nullable().optional(),
  transaction_type: z.enum(["sale", "rental", "new_development"]).optional(),
  status: z.enum(["available", "under_offer", "reserved", "sold", "let"]).optional(),
  price: z.number().nullable().optional(),
  bedrooms: z.number().int().nullable().optional(),
  bathrooms: z.number().int().nullable().optional(),
  size_sqm: z.number().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  suburb: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  photos: z.array(z.string()).max(50).optional(),
  mandate_type: z.enum(["sole", "joint", "open"]).nullable().optional(),
  mandate_expiry_date: z.string().nullable().optional(),
  lease_term_months: z.number().int().nullable().optional(),
  external_reference: z.string().max(200).nullable().optional(),
});

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

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const body = parsed.data;
  for (const key of Object.keys(body) as (keyof typeof body)[]) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (typeof body.address === "string") update.address = body.address.trim() || null;
  if (typeof body.suburb === "string") update.suburb = body.suburb.trim() || null;
  if (typeof body.description === "string") update.description = body.description.trim() || null;
  if (typeof body.external_reference === "string") {
    update.external_reference = body.external_reference.trim() || null;
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", params.listingId)
    .eq("client_id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
