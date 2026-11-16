import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  note: z.string().trim().min(1, "Write a note.").max(2000),
});

/** A manual note. It does not change the solar stage or the reminder. */
export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }
  const auth = await getAuthFromRequest(req);
  if (!auth?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Write a note." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: lead } = await supabase.from("leads").select("client_id").eq("id", params.leadId).maybeSingle();
  if (!lead?.client_id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: { id: auth.userId, name: "Sales", role: auth.role ?? "SALESPERSON" },
    eventType: "NOTE_ADDED",
    eventData: { note: parsed.data.note },
  });

  return NextResponse.json({ ok: true });
}
