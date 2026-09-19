import { NextResponse } from "next/server";
import { P } from "@/lib/auth/rbac/permissions";
import { requireSocialInbox, loadVisibleConversation } from "@/lib/social-inbox/api-auth";
import { replyToConversation, addInternalNote } from "@/lib/social-inbox/actions";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSocialInbox(req, P.SOCIAL_INBOX_REPLY);
  if (!gate.ok) return gate.response;
  if (params.id.startsWith("demo-")) {
    return NextResponse.json({ error: "Sample conversations cannot send live messages." }, { status: 400 });
  }
  const visible = await loadVisibleConversation(gate.actor, params.id);
  if (visible === "forbidden" || !visible) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    visibility?: "public" | "private";
    idempotencyKey?: string;
    internalNote?: boolean;
    aiDraft?: boolean;
  };
  if (body.internalNote) {
    const note = await addInternalNote({ actor: gate.actor, conversationId: params.id, body: body.text ?? "" });
    if (!note.ok) return NextResponse.json({ error: note.error }, { status: note.status });
    return NextResponse.json({ ok: true, note: true });
  }
  const sent = await replyToConversation({
    actor: gate.actor,
    conversationId: params.id,
    body: body.text ?? "",
    visibility: body.visibility === "public" ? "public" : "private",
    idempotencyKey: body.idempotencyKey ?? null,
    aiDraft: Boolean(body.aiDraft),
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json({ ok: true, messageId: sent.messageId });
}
