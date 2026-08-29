import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOfferUpdate } from "@/lib/real-estate/notifications";
import { canWriteOffer, reOfferStatusLabel } from "@/lib/real-estate/offers";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";

export const dynamic = "force-dynamic";

/**
 * Opt-in WhatsApp offer update. Failures are soft and never mutate offer state.
 */
export async function POST(
  _req: Request,
  { params }: { params: { clientId: string; offerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data: offer } = await supabase
    .from("real_estate_offers")
    .select("id, client_id, listing_id, contact_id, lead_id, buyer_agent_id, status, current_offer_amount")
    .eq("id", params.offerId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  if (
    !canWriteOffer({
      role: session.role,
      userId: session.userId,
      userClientId: session.clientId,
      offerClientId: params.clientId,
      buyerAgentId: (offer.buyer_agent_id as string | null) ?? null,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: listing }, { data: contact }] = await Promise.all([
    supabase
      .from("listings")
      .select("address, suburb")
      .eq("id", offer.listing_id as string)
      .eq("client_id", params.clientId)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("name, phone")
      .eq("id", offer.contact_id as string)
      .eq("client_id", params.clientId)
      .maybeSingle(),
  ]);

  try {
    await notifyOfferUpdate({
      clientId: params.clientId,
      to: (contact?.phone as string | null) ?? null,
      contactName: (contact?.name as string | null) ?? null,
      listing: { address: listing?.address as string | null, suburb: listing?.suburb as string | null },
      offerStatus: reOfferStatusLabel(offer.status as string),
      offerAmount: Number(offer.current_offer_amount),
      leadId: (offer.lead_id as string | null) ?? null,
    });
  } catch (err) {
    console.error("notifyOfferUpdate failed", err);
    return NextResponse.json({ sent: false, error: "Notification failed" }, { status: 200 });
  }

  return NextResponse.json({ sent: true });
}
