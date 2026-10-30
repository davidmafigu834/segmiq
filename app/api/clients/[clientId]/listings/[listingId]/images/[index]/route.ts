import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canReadListing, privateListingImageKey } from "@/lib/real-estate/listing-access";
import { signPrivateListingImage } from "@/lib/real-estate/private-listing-images";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: { clientId: string; listingId: string; index: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const index = Number(params.index);
  if (!Number.isSafeInteger(index) || index < 0 || index > 49) return NextResponse.json({ error: "Invalid image index", code: "INVALID_REQUEST" }, { status: 400 });
  const { data, error } = await createAdminClient().from("listings").select("id, client_id, agent_id, approval_status, photos").eq("client_id", params.clientId).eq("id", params.listingId).maybeSingle();
  if (error) return NextResponse.json({ error: "Image lookup unavailable", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (!canReadListing(guard.session, data)) return NextResponse.json({ error: "Listing is private", code: "LISTING_PRIVATE" }, { status: 403 });
  const key = privateListingImageKey(Array.isArray(data.photos) ? data.photos[index] : null, params.clientId, params.listingId);
  if (!key) return NextResponse.json({ error: "Image needs private storage migration", code: "IMAGE_UNAVAILABLE" }, { status: 409 });
  try {
    const ext = key.split(".").pop()!.toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const url = await signPrivateListingImage(key, mime);
    return NextResponse.json({ url, expiresAt: new Date(Date.now() + 300000).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Image service unavailable", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
