import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateWebsiteIntegrationApiKey } from "@/lib/real-estate/helpers";
import { maskWebsiteApiKey } from "@/lib/real-estate/marketing";
import {
  hashWebsiteApiKey,
  websiteApiKeyPrefix,
} from "@/lib/auth/website-api-keys";
import { assertBrowserOrigin } from "@/lib/auth/origin-check";
import { requireElevatedSession } from "@/lib/auth/step-up";
import { recordSecurityEvent } from "@/lib/auth/security-events";
import { clientIpFromRequest, userAgentFromRequest } from "@/lib/auth/user-sessions";

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
    .select(
      "id, website_integration_api_key, website_integration_api_key_hash, website_integration_api_key_prefix, website_integration_key_rotated_at, business_type"
    )
    .eq("id", params.clientId)
    .maybeSingle();

  if (error || !client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hash = (client.website_integration_api_key_hash as string | null) ?? null;
  const legacy = (client.website_integration_api_key as string | null) ?? null;
  const prefix = (client.website_integration_api_key_prefix as string | null) ?? null;
  const hasKey = Boolean(hash || legacy);
  const masked = prefix
    ? `${prefix}••••••••`
    : maskWebsiteApiKey(legacy);

  return NextResponse.json({
    has_key: hasKey,
    api_key_masked: masked,
    rotated_at: (client.website_integration_key_rotated_at as string | null) ?? null,
    business_type: client.business_type ?? "trades",
  });
}

/** POST generate or regenerate. Returns the full key once. Invalidates the previous key. */
export async function POST(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKey(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const elev = await requireElevatedSession({
    sessionId: session.sessionId,
    userId: session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  const key = generateWebsiteIntegrationApiKey();
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      website_integration_api_key: null,
      website_integration_api_key_hash: hashWebsiteApiKey(key),
      website_integration_api_key_prefix: websiteApiKeyPrefix(key),
      website_integration_key_rotated_at: now,
      updated_at: now,
    })
    .eq("id", params.clientId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  void recordSecurityEvent({
    eventType: "WEBSITE_API_KEY_ROTATED",
    userId: session.userId,
    clientId: params.clientId,
    sessionId: session.sessionId,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });

  return NextResponse.json({
    api_key: key,
    api_key_masked: maskWebsiteApiKey(key),
    rotated: true,
    rotated_at: now,
  });
}

/** DELETE revoke. The previous key stops working immediately. */
export async function DELETE(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  const origin = assertBrowserOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId) && session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canManageKey(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const elev = await requireElevatedSession({
    sessionId: session.sessionId,
    userId: session.userId,
  });
  if (!elev.ok) {
    return NextResponse.json({ error: elev.error }, { status: elev.status });
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      website_integration_api_key: null,
      website_integration_api_key_hash: null,
      website_integration_api_key_prefix: null,
      website_integration_key_rotated_at: now,
      updated_at: now,
    })
    .eq("id", params.clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void recordSecurityEvent({
    eventType: "WEBSITE_API_KEY_REVOKED",
    userId: session.userId,
    clientId: params.clientId,
    sessionId: session.sessionId,
    ip: clientIpFromRequest(req),
    userAgent: userAgentFromRequest(req),
  });

  return NextResponse.json({ ok: true, revoked: true, rotated_at: now });
}
