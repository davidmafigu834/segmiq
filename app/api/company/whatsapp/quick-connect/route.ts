import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWhatsAppConnectionAdmin } from "@/lib/whatsapp/connection-auth";
import { createOrResetTemporaryConnection, transitionWhatsAppConnection } from "@/lib/whatsapp/connections";
import { assertTemporaryWhatsAppRuntimeConfigured, isTemporaryWhatsAppFeatureEnabled } from "@/lib/whatsapp/feature-flags";
import { callWhatsAppGateway } from "@/lib/whatsapp/gateway-client";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireWhatsAppConnectionAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isTemporaryWhatsAppFeatureEnabled()) {
    return NextResponse.json({ error: "Quick connection is not enabled" }, { status: 404 });
  }
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("whatsapp_temporary_web_enabled")
    .eq("id", auth.admin.clientId)
    .maybeSingle();
  if (!client?.whatsapp_temporary_web_enabled) {
    return NextResponse.json({ error: "This company is not enrolled in the quick connection beta" }, { status: 403 });
  }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("whatsapp_connection_events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", auth.admin.clientId)
    .gte("created_at", since);
  if ((count ?? 0) >= 6) {
    return NextResponse.json({ error: "Too many connection attempts. Try again in a minute." }, { status: 429 });
  }
  try {
    assertTemporaryWhatsAppRuntimeConfigured();
    const connection = await createOrResetTemporaryConnection({
      clientId: auth.admin.clientId,
      actorId: auth.admin.userId,
    });
    try {
      await callWhatsAppGateway({
        path: `/v1/connections/${encodeURIComponent(connection.id)}/connect`,
        body: {},
      });
    } catch (error) {
      await transitionWhatsAppConnection({
        connectionId: connection.id,
        to: "ERROR",
        errorCode: "GATEWAY_UNAVAILABLE",
        errorMessage: error instanceof Error ? error.message : "Gateway unavailable",
      });
      throw error;
    }
    return NextResponse.json({ ok: true, connectionId: connection.id }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start quick connection" },
      { status: 503 }
    );
  }
}
