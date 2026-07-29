import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWebsiteIntegrationApiKey } from "@/lib/real-estate/helpers";

export const dynamic = "force-dynamic";

/** GET current key (masked) + example curl for Website Integration. */
export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, website_integration_api_key, business_type, slug")
    .eq("id", params.clientId)
    .maybeSingle();

  if (error || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const key = (client.website_integration_api_key as string | null) ?? null;
  const masked =
    key && key.length > 12 ? `${key.slice(0, 10)}…${key.slice(-4)}` : key ? "••••••••" : null;

  return NextResponse.json({
    has_key: Boolean(key),
    api_key_masked: masked,
    api_key: session.role === "AGENCY_ADMIN" || session.role === "CLIENT_MANAGER" ? key : masked,
    business_type: client.business_type ?? "trades",
  });
}

/** POST generate (or rotate) the website integration API key. */
export async function POST(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = generateWebsiteIntegrationApiKey();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      website_integration_api_key: key,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.clientId)
    .select("id, website_integration_api_key")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ api_key: key, rotated: true });
}
