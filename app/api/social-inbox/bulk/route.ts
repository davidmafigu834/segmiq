import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox } from "@/lib/social-inbox/api-auth";
import { bulkAssign } from "@/lib/social-inbox/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSocialAudit } from "@/lib/social-inbox/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_ASSIGN);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    conversationIds?: string[];
    assigneeId?: string | null;
  };
  const ids = (body.conversationIds ?? []).slice(0, 50);
  if (body.action === "assign") {
    const result = await bulkAssign({
      actor: gate.actor,
      conversationIds: ids,
      assigneeId: body.assigneeId ?? null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "read" || body.action === "resolve") {
    const supabase = createAdminClient();
    const patch =
      body.action === "read"
        ? { unread: false, updated_at: new Date().toISOString() }
        : { status: "resolved", unread: false, updated_at: new Date().toISOString() };
    await supabase
      .from("social_conversations")
      .update(patch)
      .eq("client_id", gate.actor.clientId)
      .in("id", ids);
    await logSocialAudit({
      clientId: gate.actor.clientId,
      actorId: gate.actor.userId,
      actorName: gate.actor.name,
      eventType: body.action === "resolve" ? "bulk_resolve" : "bulk_assign",
      metadata: { count: ids.length, action: body.action },
    });
    return NextResponse.json({ ok: true, count: ids.length });
  }
  return NextResponse.json({ error: "Unknown bulk action." }, { status: 400 });
}
