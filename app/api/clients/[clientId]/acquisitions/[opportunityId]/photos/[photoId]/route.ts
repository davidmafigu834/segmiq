import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { getAcquisitionBundle, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";
import { privateListingImageKey } from "@/lib/real-estate/listing-access";
import { readPrivateListingImage } from "@/lib/real-estate/private-listing-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorFrom(session: { userId: string; role: string; clientId?: string | null; user?: { name?: string | null } }): AcquisitionActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId ?? null };
}

/** Streams one inspection photograph after the agent is allowed to open that house. */
export async function GET(_req: Request, { params }: { params: { clientId: string; opportunityId: string; photoId: string } }) {
  const guard = await requireClientAccessFromRequest(_req, params.clientId);
  if (guard.error) return guard.error;
  if (!UUID.test(params.opportunityId) || !UUID.test(params.photoId)) {
    return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
  }
  const bundle = await getAcquisitionBundle(params.clientId, params.opportunityId, actorFrom(guard.session));
  if (!bundle.ok) return NextResponse.json({ error: bundle.error }, { status: bundle.status });
  const photo = bundle.photos.find((row) => row.id === params.photoId);
  const listingId = (bundle.opportunity.converted_listing_id as string | null) ?? null;
  const key = listingId ? privateListingImageKey(photo?.storage_key, params.clientId, listingId) : null;
  if (!key) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const image = await readPrivateListingImage(key);
  if (!image) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  return new NextResponse(Buffer.from(image.bytes), {
    headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300" },
  });
}
