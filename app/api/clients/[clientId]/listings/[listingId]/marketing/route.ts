import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { getListingMarketing } from "@/lib/real-estate/marketing-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; listingId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }
  const result = await getListingMarketing({
    clientId: params.clientId,
    listingId: params.listingId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
