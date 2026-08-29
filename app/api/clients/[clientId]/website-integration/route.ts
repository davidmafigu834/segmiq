import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWebsiteIntegrationApiKey } from "@/lib/real-estate/helpers";
import { maskWebsiteApiKey } from "@/lib/real-estate/marketing";

export const dynamic = "force-dynamic";

function canManageKey(role: string) {
  return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
}

/**
 * GET — status and masked key only. Full key is never returned after creation.
 */
export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, website_integration_api_key, website_integration_key_rotated_at, business_type")
    .eq("id", params.clientId)
    .maybeSingle();

  if (error || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const key = (client.website_integration_api_key as string | null) ?? null;
  return NextResponse.json({
    has_key: Boolean(key),
    api_key_masked: maskWebsiteApiKey(key),
    rotated_at: (client.website_integration_key_rotated_at as string | null) ?? null,
    business_type: client.business_type ?? "trades",
  });
}

/** POST generate or regenerate. Returns the full key once. Invalidates the previous key. */
export async function POST(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKey(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = generateWebsiteIntegrationApiKey();
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      website_integration_api_key: key,
      website_integration_key_rotated_at: now,
      updated_at: now,
    })
    .eq("id", params.clientId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({
    api_key: key,
    api_key_masked: maskWebsiteApiKey(key),
    rotated: true,
    rotated_at: now,
  });
}

/** DELETE revoke. The previous key stops working immediately. */
export async function DELETE(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKey(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      website_integration_api_key: null,
      website_integration_key_rotated_at: now,
      updated_at: now,
    })
    .eq("id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, revoked: true, rotated_at: now });
}
