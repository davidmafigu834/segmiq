import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendInterestedListingIds, listingLabel } from "@/lib/real-estate/helpers";
import { notifyPropertyMatch } from "@/lib/real-estate/notifications";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  contact_id: z.string().uuid(),
});

/**
 * One-tap property match send — reuses WhatsApp PROPERTY_MATCH_ALERT template
 * (same soft-send pattern as SendAssetPanel → send-asset).
 */
export async function POST(
  req: Request,
  { params }: { params: { clientId: string; listingId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, phone, interested_listing_ids")
    .eq("id", parsed.data.contact_id)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  await notifyPropertyMatch({
    clientId: params.clientId,
    to: contact.phone,
    contactName: contact.name,
    listing,
  });

  const next = appendInterestedListingIds(contact.interested_listing_ids, params.listingId);
  await supabase
    .from("contacts")
    .update({ interested_listing_ids: next, updated_at: new Date().toISOString() })
    .eq("id", contact.id);

  return NextResponse.json({
    ok: true,
    sent_to: contact.phone,
    listing_label: listingLabel(listing),
  });
}
