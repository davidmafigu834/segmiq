import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { canSubmitListings } from "@/lib/real-estate/listings";
import { propertySurfacesForRole } from "@/lib/real-estate/property-register";
import { readPropertyFile } from "@/lib/real-estate/property-register-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in guard) return guard.error;
  if (!canSubmitListings(guard.session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const surface = url.searchParams.get("surface");
  if (surface !== "sales" && surface !== "client") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!propertySurfacesForRole(guard.session.role).includes(surface)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const listingId = url.searchParams.get("listingId");
  const opportunityId = url.searchParams.get("opportunityId");
  if (Boolean(listingId) === Boolean(opportunityId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = await readPropertyFile({
    clientId: params.clientId,
    actor: {
      userId: guard.session.userId,
      role: guard.session.role,
      clientId: guard.session.clientId,
      name: guard.session.user?.name,
    },
    surface,
    listingId,
    opportunityId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
