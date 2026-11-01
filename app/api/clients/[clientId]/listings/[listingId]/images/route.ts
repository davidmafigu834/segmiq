import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { listingActions, listingReadDto, privateListingImageKey } from "@/lib/real-estate/listing-access";
import {
  detectPrivateListingImage,
  isPrivateListingImageStorageConfigured,
  privateListingPhotoFileName,
  putPrivateListingImage,
} from "@/lib/real-estate/private-listing-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Attaches one phone photograph to a listing the actor may edit. Public storage is never used. */
export async function POST(req: Request, { params }: { params: { clientId: string; listingId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  if (!UUID.test(params.listingId)) return NextResponse.json({ error: "Invalid listing", code: "INVALID_REQUEST" }, { status: 400 });
  const actor = { userId: guard.session.userId, role: guard.session.role, clientId: guard.session.clientId };
  if (!isPrivateListingImageStorageConfigured()) {
    return NextResponse.json({ error: "Private listing image storage is not configured", code: "STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  const supabase = createAdminClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, client_id, agent_id, approval_status, photos")
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Image lookup unavailable", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
  if (!listing) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (!listingActions(actor, listing).edit) {
    return NextResponse.json({ error: "Agents can only change photographs on their own draft or pending listings", code: "FORBIDDEN" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a photograph", code: "INVALID_REQUEST" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectPrivateListingImage(bytes);
  if (!detected.ok) {
    const status = detected.code === "TOO_LARGE" ? 413 : 415;
    return NextResponse.json({ error: "Upload a JPEG, PNG, WebP or AVIF photograph up to 20 MB. HEIC is not accepted.", code: detected.code === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "UNSUPPORTED_MEDIA" }, { status });
  }
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const key = `clients/${params.clientId}/listings/${params.listingId}/photos/${privateListingPhotoFileName(idempotencyKey, detected.ext)}`;
  if (!privateListingImageKey(key, params.clientId, params.listingId)) {
    return NextResponse.json({ error: "Invalid image key", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const current = Array.isArray(listing.photos) ? listing.photos.filter((value): value is string => typeof value === "string") : [];
  if (!current.includes(key) && current.length >= 50) {
    return NextResponse.json({ error: "A listing can have up to 50 photographs", code: "LIMIT_REACHED" }, { status: 409 });
  }
  try {
    await putPrivateListingImage(key, Buffer.from(bytes), detected.mime);
  } catch {
    return NextResponse.json({ error: "Private image storage is unavailable", code: "STORAGE_UNAVAILABLE" }, { status: 503 });
  }
  const cover = form?.get("cover") === "true";
  const without = current.filter((value) => value !== key);
  const photos = cover ? [key, ...without] : [...without, key];
  const { data: saved, error: updateError } = await supabase
    .from("listings")
    .update({ photos, updated_at: new Date().toISOString() })
    .eq("id", params.listingId)
    .eq("client_id", params.clientId)
    .select("*")
    .maybeSingle();
  if (updateError || !saved) return NextResponse.json({ error: "The photograph was stored but the listing order was not saved", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
  const index = photos.indexOf(key);
  return NextResponse.json({
    listing: listingReadDto(actor, saved, true),
    image: { index, cover: index === 0, endpoint: `/api/clients/${params.clientId}/listings/${params.listingId}/images/${index}` },
    idempotent: current.includes(key),
  }, { status: current.includes(key) ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
