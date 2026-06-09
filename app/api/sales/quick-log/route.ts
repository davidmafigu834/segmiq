import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCallLog } from "@/lib/call-log-save";
import { logCallBodySchema } from "@/lib/call-log-schema";
import type { CallResult, ReachOutcome } from "@/lib/call-log-constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requireRoles(["SALESPERSON"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const supabase = createAdminClient();

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId = typeof raw.leadId === "string" ? raw.leadId.trim() : "";
  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const bodyForZod = { ...raw };
  delete bodyForZod.leadId;
  const parsed = logCallBodySchema.safeParse(bodyForZod);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path[0];
    return NextResponse.json(
      {
        error: issue.message,
        ...(typeof path === "string" ? { field: path } : {}),
      },
      { status: 400 }
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("assigned_to_id", session!.userId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json(
      { error: "Lead not found or not assigned to you" },
      { status: 404 }
    );
  }

  const {
    reachOutcome,
    result,
    reason,
    callbackAt,
    assetsRequested,
    notes,
    channel,
    isConvertLaterPick,
    convertLaterNote,
    dealValue,
  } = parsed.data;

  try {
    const saved = await saveCallLog({
      leadId,
      actorUserId: session!.userId,
      actor: {
        id: session!.userId,
        name: session!.user.name ?? "Unknown",
        role: "SALESPERSON",
      },
      reachOutcome: reachOutcome as ReachOutcome,
      result: (result ?? null) as CallResult | null,
      reason: reason ?? null,
      callbackAt: callbackAt ?? null,
      assetsRequested: assetsRequested ?? null,
      notes,
      channel,
      isConvertLaterPick,
      convertLaterNote: convertLaterNote ?? null,
      dealValue: dealValue ?? null,
    });

    return NextResponse.json({
      success: true,
      lead: saved.lead,
      legacyOutcome: saved.legacyOutcome,
      noAnswerCount: saved.noAnswerCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to log call";
    if (msg === "Lead not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[quick-log]", err);
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 });
  }
}
