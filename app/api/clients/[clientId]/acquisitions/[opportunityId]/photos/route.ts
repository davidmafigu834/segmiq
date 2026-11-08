import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachInspectionPhoto, getAcquisitionBundle, type AcquisitionActor } from "@/lib/real-estate/acquisition-service";
import { listingActions, privateListingImageKey } from "@/lib/real-estate/listing-access";
import {
  detectPrivateListingImage,
  isPrivateListingImageStorageConfigured,
  privateListingPhotoFileName,
  putPrivateListingImage,
} from "@/lib/real-estate/private-listing-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorFrom(session: { userId: string; role: string; clientId?: string | null; user?: { name?: string | null } }): AcquisitionActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId ?? null };
}

/** Stores an inspection photograph on the draft listing. The browser never talks to storage directly. */
export async function POST(req: Request, { params }: { params: { clientId: string; opportunityId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  if (!UUID.test(params.opportunityId)) return NextResponse.json({ error: "Invalid inspection" }, { status: 400 });
  const actor = actorFrom(guard.session);
  const bundle = await getAcquisitionBundle(params.clientId, params.opportunityId, actor);
  if (!bundle.ok) return NextResponse.json({ error: bundle.error }, { status: bundle.status });

  const listingId = (bundle.opportunity.converted_listing_id as string | null) ?? null;
  if (!listingId) {
    return NextResponse.json({ error: "This house does not have a draft listing yet. Open the completed seller form, then add the photo." }, { status: 409 });
  }
  if (!isPrivateListingImageStorageConfigured()) {
    return NextResponse.json({ error: "Photo storage is not configured for this house." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const inspectionId = String(form?.get("inspectionId") ?? "");
  const file = form?.get("file");
  if (!UUID.test(inspectionId) || !bundle.inspections.some((row) => row.id === inspectionId)) {
    return NextResponse.json({ error: "Save the inspection before adding photos." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a photograph." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, client_id, agent_id, approval_status, photos")
    .eq("id", listingId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "The listing could not be opened." }, { status: 503 });
  if (!listing) return NextResponse.json({ error: "The draft listing was not found." }, { status: 404 });
  if (!listingActions({ userId: actor.id, role: actor.role, clientId: actor.clientId }, listing).edit) {
    return NextResponse.json({ error: "Photos can be added while this listing is still a draft." }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectPrivateListingImage(bytes);
  if (!detected.ok) {
    const status = detected.code === "TOO_LARGE" ? 413 : 415;
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP or AVIF photograph up to 20 MB." }, { status });
  }

  const key = `clients/${params.clientId}/listings/${listingId}/photos/${privateListingPhotoFileName(null, detected.ext)}`;
  if (!privateListingImageKey(key, params.clientId, listingId)) {
    return NextResponse.json({ error: "The photo could not be stored." }, { status: 400 });
  }
  const current = Array.isArray(listing.photos) ? listing.photos.filter((value): value is string => typeof value === "string") : [];
  if (current.length >= 50) return NextResponse.json({ error: "This house already has 50 photographs." }, { status: 409 });

  try {
    await putPrivateListingImage(key, Buffer.from(bytes), detected.mime);
  } catch {
    return NextResponse.json({ error: "Photo storage is not configured for this house." }, { status: 503 });
  }

  const photos = [...current, key];
  const { error: updateError } = await supabase
    .from("listings")
    .update({ photos, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("client_id", params.clientId);
  if (updateError) return NextResponse.json({ error: "The photograph was stored but the listing was not updated." }, { status: 503 });

  const attached = await attachInspectionPhoto({
    clientId: params.clientId,
    inspectionId,
    actor,
    storageKey: key,
    caption: file.name.slice(0, 300),
  });
  if (!attached.ok) return NextResponse.json({ error: attached.error }, { status: attached.status });
  return NextResponse.json({ photo: attached.photo }, { status: 201 });
}
