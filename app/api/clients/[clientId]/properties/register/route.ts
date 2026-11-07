import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { canSubmitListings } from "@/lib/real-estate/listings";
import { propertySurfacesForRole, type PropertyGroup } from "@/lib/real-estate/property-register";
import { readPropertyRegister } from "@/lib/real-estate/property-register-service";

export const dynamic = "force-dynamic";

const GROUPS = new Set<PropertyGroup>(["all", "drafts", "listings", "inactive"]);

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
  const groupParam = url.searchParams.get("group") ?? "all";
  if (!GROUPS.has(groupParam as PropertyGroup)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = await readPropertyRegister({
    clientId: params.clientId,
    actor: {
      userId: guard.session.userId,
      role: guard.session.role,
      clientId: guard.session.clientId,
      name: guard.session.user?.name,
    },
    surface,
    query: url.searchParams.get("q"),
    group: groupParam as PropertyGroup,
    page,
    pageSize,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
