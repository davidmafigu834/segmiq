import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox } from "@/lib/social-inbox/api-auth";
import { listConnections } from "@/lib/social-inbox/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSocialAudit } from "@/lib/social-inbox/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_VIEW);
  if (!gate.ok) return gate.response;
  const connections = await listConnections(gate.actor.clientId);
  const configured = Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
  return NextResponse.json({
    connections,
    metaConfigured: configured,
    demoAvailable: process.env.NODE_ENV !== "production" || process.env.SOCIAL_INBOX_DEMO === "1",
  });
}

export async function POST(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_MANAGE_CHANNELS);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { action?: string; connectionId?: string };
  if (body.action === "disconnect" && body.connectionId) {
    const supabase = createAdminClient();
    await supabase
      .from("social_channel_connections")
      .update({
        status: "disconnected",
        token_sealed: null,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.connectionId)
      .eq("client_id", gate.actor.clientId);
    await logSocialAudit({
      clientId: gate.actor.clientId,
      actorId: gate.actor.userId,
      actorName: gate.actor.name,
      eventType: "channel_disconnected",
      metadata: { connectionId: body.connectionId },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
