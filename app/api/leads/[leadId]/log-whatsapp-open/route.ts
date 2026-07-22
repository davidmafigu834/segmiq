import { NextResponse } from "next/server";
import { requireSalesActor } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const g = await requireSalesActor();
  if ("error" in g) return g.error;
  const { session } = g;

  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, name")
    .eq("id", params.leadId)
    .eq("assigned_to_id", session!.userId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found or not assigned to you" }, { status: 404 });
  }

  let body: { note?: string } = {};
  try {
    body = (await req.json()) as { note?: string };
  } catch {
    // ignore
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : `Opened WhatsApp to message ${(lead.name as string | null)?.split(" ")[0] ?? "Lead"}`;

  await logLeadEvent({
    leadId: params.leadId,
    clientId: lead.client_id as string,
    actor: { id: session!.userId, name: session!.user?.name ?? "Unknown", role: session!.role },
    eventType: "NOTE_ADDED",
    eventData: { note },
  });

  return NextResponse.json({ ok: true });
}
