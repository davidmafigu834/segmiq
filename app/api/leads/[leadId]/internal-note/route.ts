import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canModifyLead, canReadLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";

const bodySchema = z.object({
  note: z.string().min(1).max(2000),
  pinToTop: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canModifyLead(params.leadId, req);
  const session = !access.allowed ? await getServerSession(authOptions) : null;
  const managerAccess =
    !access.allowed && session?.role === "CLIENT_MANAGER"
      ? await canReadLead(params.leadId, req)
      : null;
  if (!access.allowed && !managerAccess?.ok) {
    if (managerAccess) {
      return NextResponse.json({ error: "Not found" }, { status: managerAccess.status });
    }
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

  const actorId = access.allowed ? access.userId : session!.userId!;
  const actorRole = access.allowed ? access.role : "CLIENT_MANAGER";

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("client_id")
    .eq("id", params.leadId)
    .maybeSingle();

  if (!lead?.client_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: actorUser } = await supabase.from("users").select("name").eq("id", actorId).maybeSingle();

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: {
      id: actorId,
      name: (actorUser as { name: string } | null)?.name ?? "Unknown",
      role: actorRole,
    },
    eventType: "NOTE_ADDED",
    eventData: {
      note: parsed.data.note.trim(),
      notes: parsed.data.note.trim(),
      internal: true,
      visibility: "internal",
    },
    pinOnCreate: parsed.data.pinToTop ? { userId: actorId } : undefined,
  });

  return NextResponse.json({ ok: true });
}
