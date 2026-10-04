import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageWorkProjects } from "@/lib/work-projects/access";
import { workProjectActor } from "@/lib/work-projects/http";
import { invitePortalContact, revokePortalContact } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["invite", "revoke"]) });

export async function POST(req: Request, { params }: { params: { contactId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId || !canManageWorkProjects(actor, actor.clientId)) {
    return NextResponse.json({ error: "Only a manager can manage portal access." }, { status: 403 });
  }
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the portal details." }, { status: 400 });
  if (body.data.action === "revoke") {
    const result = await revokePortalContact(actor.clientId, params.contactId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const result = await invitePortalContact({ userId: actor.userId, clientId: actor.clientId }, params.contactId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ link: result.link, sent: result.sent });
}
