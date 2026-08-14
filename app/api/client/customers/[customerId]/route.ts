import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { getCompanyCustomerDetail } from "@/lib/sales/get-company-customers-page-data";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { customerId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;
  const clientId = new URL(req.url).searchParams.get("clientId") || session!.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const detail = await getCompanyCustomerDetail({ clientId, customerId: params.customerId });
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (error) {
    console.error("[client/customers/customer]", error);
    return NextResponse.json({ error: "Failed to load Customer" }, { status: 500 });
  }
}
