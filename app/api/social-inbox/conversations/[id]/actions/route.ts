import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox, loadVisibleConversation } from "@/lib/social-inbox/api-auth";
import {
  assignConversation,
  clearSocialFollowUp,
  convertOpportunityToLead,
  createDealFromSocial,
  createSocialFollowUp,
  dismissSocialOpportunity,
  linkSocialIdentity,
  resolveConversation,
  setConversationRead,
} from "@/lib/social-inbox/actions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_VIEW);
  if (!gate.ok) return gate.response;
  const visible = await loadVisibleConversation(gate.actor, params.id);
  if (visible === "forbidden" || !visible) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    assigneeId?: string | null;
    resolved?: boolean;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
    followUpAt?: string;
    reason?: string;
    contactId?: string | null;
    leadId?: string | null;
    rejected?: boolean;
    read?: boolean;
    clear?: boolean;
    completed?: boolean;
  };

  switch (body.action) {
    case "read": {
      await setConversationRead(gate.actor.clientId, params.id, body.read !== false);
      return NextResponse.json({ ok: true });
    }
    case "not_sales": {
      const result = await dismissSocialOpportunity({
        actor: gate.actor,
        conversationId: params.id,
        reason: body.reason ?? null,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    case "assign": {
      const perm = await requireSocialInbox(req, P.SOCIAL_INBOX_ASSIGN);
      if (!perm.ok) return perm.response;
      const result = await assignConversation({
        actor: perm.actor,
        conversationId: params.id,
        assigneeId: body.assigneeId ?? null,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    case "resolve": {
      const result = await resolveConversation({
        actor: gate.actor,
        conversationId: params.id,
        resolved: body.resolved !== false,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    case "convert": {
      const perm = await requireSocialInbox(req, P.SOCIAL_INBOX_CONVERT_LEAD);
      if (!perm.ok) return perm.response;
      const result = await convertOpportunityToLead({
        actor: perm.actor,
        conversationId: params.id,
        name: body.name,
        phone: body.phone,
        email: body.email,
        notes: body.notes,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, leadId: result.leadId, duplicate: result.duplicate });
    }
    case "create_deal": {
      const perm = await requireSocialInbox(req, P.SOCIAL_INBOX_CREATE_DEAL);
      if (!perm.ok) return perm.response;
      const result = await createDealFromSocial({
        actor: perm.actor,
        conversationId: params.id,
        name: body.name,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, dealId: result.dealId, leadId: result.leadId });
    }
    case "follow_up": {
      const result = body.clear
        ? await clearSocialFollowUp({
            actor: gate.actor,
            conversationId: params.id,
            completed: body.completed,
          })
        : await createSocialFollowUp({
            actor: gate.actor,
            conversationId: params.id,
            followUpAt: body.followUpAt ?? "",
            reason: body.reason,
          });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    case "link_identity": {
      const result = await linkSocialIdentity({
        actor: gate.actor,
        conversationId: params.id,
        contactId: body.contactId,
        leadId: body.leadId,
        rejected: body.rejected,
      });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
