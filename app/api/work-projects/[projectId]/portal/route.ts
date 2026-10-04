import { NextResponse } from "next/server";
import { z } from "zod";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";
import { getWorkProject } from "@/lib/work-projects/service";
import { canManageWorkProjects } from "@/lib/work-projects/access";
import { invitePortalContact, revokePortalContact, shareProjectDocument } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["invite", "revoke", "share"]),
  contactId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  visible: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const loaded = await getWorkProject(actor, params.projectId);
  if (!loaded.ok) return workProjectError(loaded);
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) {
    return NextResponse.json({ error: "Only a manager can manage portal access." }, { status: 403 });
  }
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the portal details." }, { status: 400 });
  if (body.data.action === "share") {
    if (!body.data.documentId) return NextResponse.json({ error: "Choose a document." }, { status: 400 });
    const result = await shareProjectDocument(actor.clientId, params.projectId, body.data.documentId, Boolean(body.data.visible));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const contactId = body.data.contactId || loaded.data.project.contact_id;
  if (!contactId) return NextResponse.json({ error: "This project has no customer yet." }, { status: 400 });
  if (body.data.action === "revoke") {
    const result = await revokePortalContact(actor.clientId, contactId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const result = await invitePortalContact({ userId: actor.userId, clientId: actor.clientId }, contactId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ link: result.link, sent: result.sent });
}
