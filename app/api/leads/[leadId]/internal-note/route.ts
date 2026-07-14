import { NextResponse } from "next/server";
import { z } from "zod";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";

const bodySchema = z.object({
  note: z.string().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const access = await canModifyLead(params.leadId, req);
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: access.status });
  }

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

  const { data: actorUser } = await supabase.from("users").select("name").eq("id", access.userId).maybeSingle();

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: {
      id: access.userId,
      name: (actorUser as { name: string } | null)?.name ?? "Unknown",
      role: access.role,
    },
    eventType: "NOTE_ADDED",
    eventData: {
      note: parsed.data.note.trim(),
      internal: true,
      visibility: "internal",
    },
  });

  return NextResponse.json({ ok: true });
}
