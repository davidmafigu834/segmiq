import { NextResponse } from "next/server";
import { checkDbRateLimit } from "@/lib/auth/db-rate-limit";
import { createHash } from "crypto";
import { clientIpFromRequest } from "@/lib/auth/user-sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateListingImage } from "@/lib/real-estate/private-listing-images";
import { acceptsNewEnquiry, isOpaqueShareToken, listingMarketingGate, privatePhotoKeyAt, shareAcceptsAttribution } from "@/lib/real-estate/agent-listing-pages/policy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const index = Number(url.searchParams.get("index"));
  const token = url.searchParams.get("token");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(index) || index < 0 || index > 49) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }
  if (token && !isOpaqueShareToken(token)) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const ip = clientIpFromRequest(req) ?? "unknown";
  const ipKey = createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? "listing"}:${ip}`).digest("hex").slice(0, 24);
  const limited = await checkDbRateLimit({ key: `listing-page:media:${ipKey}`, limit: 120, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 });

  const db = createAdminClient();
  const { data: listing } = await db
    .from("listings")
    .select("id, client_id, approval_status, status, photos")
    .eq("public_slug", slug)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const { data: client } = await db.from("clients").select("id, business_type, is_active, is_archived, security_suspended_at").eq("id", listing.client_id).maybeSingle();
  const { data: settings } = await db.from("re_agency_listing_page_settings").select("enabled").eq("client_id", listing.client_id).maybeSingle();
  const gate = listingMarketingGate({
    organisationId: String(listing.client_id),
    listingOrganisationId: String(listing.client_id),
    approvalStatus: listing.approval_status as string | null,
    status: listing.status as string | null,
    featureEnabled: settings ? settings.enabled !== false : true,
    organisationActive: Boolean(client) && client?.business_type === "real_estate" && client.is_active !== false && client.is_archived !== true && !client.security_suspended_at,
  });
  if (!gate.ok || !acceptsNewEnquiry(gate)) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  if (token) {
    const { data: share } = await db.from("re_agent_listing_shares").select("id, listing_id, status, agent_id").eq("token", token).maybeSingle();
    if (!share || share.listing_id !== listing.id) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    const { data: agent } = await db.from("users").select("client_id, role, is_active, also_sells").eq("id", share.agent_id).maybeSingle();
    const live = shareAcceptsAttribution({
      shareStatus: share.status,
      listingOrganisationId: String(listing.client_id),
      agent: {
        clientId: agent?.client_id ?? null,
        role: agent?.role ?? null,
        active: agent?.is_active !== false,
        archived: false,
        alsoSells: agent?.also_sells === true,
      },
    });
    if (!live) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }
  const key = privatePhotoKeyAt(listing.photos, String(listing.client_id), String(listing.id), index);
  if (!key) return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  const image = await readPrivateListingImage(key);
  if (!image) return NextResponse.json({ error: "Photograph unavailable", code: "MEDIA_UNAVAILABLE" }, { status: 404 });
  return new NextResponse(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
