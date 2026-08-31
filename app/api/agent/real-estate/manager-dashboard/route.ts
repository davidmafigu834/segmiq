import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadReManagerAgentDashboard } from "@/lib/agent/real-estate/manager-dashboard";
import { isRealEstate } from "@/lib/terminology";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveApiAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "CLIENT_MANAGER" && auth.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const requestedClient = url.searchParams.get("clientId");
  const clientId =
    auth.role === "SUPER_ADMIN" ? requestedClient ?? auth.clientId : auth.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (auth.role === "CLIENT_MANAGER" && auth.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("business_type")
    .eq("id", clientId)
    .maybeSingle();
  if (!isRealEstate(client?.business_type)) {
    return NextResponse.json({ error: "Not a real-estate company" }, { status: 403 });
  }

  const dashboard = await loadReManagerAgentDashboard({ clientId });
  return NextResponse.json(dashboard);
}
