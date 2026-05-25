import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCallLogged } from "@/lib/lead-events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireRoles(["SALESPERSON"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const supabase = createAdminClient();

  let body: { leadId?: string; outcome?: string; notes?: string };
  try {
    body = (await req.json()) as { leadId?: string; outcome?: string; notes?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leadId, outcome, notes } = body;

  if (!leadId || !outcome) {
    return NextResponse.json({ error: "leadId and outcome required" }, { status: 400 });
  }

  // Verify this lead is assigned to the current salesperson
  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, status, name")
    .eq("id", leadId)
    .eq("assigned_to_id", session!.userId)
    .single();

  if (!lead) {
    return NextResponse.json(
      { error: "Lead not found or not assigned to you" },
      { status: 404 }
    );
  }

  // Insert call log
  const { error: logError } = await supabase.from("call_logs").insert({
    lead_id: leadId,
    user_id: session!.userId,
    outcome,
    notes: notes?.trim() || null,
  });

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // Progress lead status: any outcome moves NEW → CONTACTED
  if ((lead.status as string) === "NEW") {
    const nextStatus: Record<string, string> = {
      ANSWERED: "CONTACTED",
      NO_ANSWER: "CONTACTED",
      FOLLOW_UP: "CONTACTED",
      WON: "WON",
      LOST: "LOST",
      NOT_QUALIFIED: "NOT_QUALIFIED",
    };
    const newStatus = nextStatus[outcome];
    if (newStatus) {
      await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);
    }
  }

  // Log event to lead timeline (fire-and-forget; never throws)
  await logCallLogged({
    leadId,
    clientId: lead.client_id as string,
    actor: {
      id: session!.userId,
      name: session!.user.name ?? "Unknown",
      role: "SALESPERSON",
    },
    outcome,
    notes: notes?.trim() || null,
  });

  return NextResponse.json({ success: true });
}
