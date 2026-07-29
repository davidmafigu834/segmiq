import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth/getAuthFromRequest";
import { canModifyLead } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCallLog } from "@/lib/call-log-save";
import { logCallBodySchema } from "@/lib/call-log-schema";
import type { CallResult, ReachOutcome } from "@/lib/call-log-constants";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const leadId = params.leadId;
  const supabase = createAdminClient();

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const magicTokenRaw = raw.magicToken;
  const magicToken = typeof magicTokenRaw === "string" ? magicTokenRaw.trim() : "";
  const bodyForZod = { ...raw };
  delete bodyForZod.magicToken;
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

  // Real-estate optional listing fields (validated by zod when present)
  const listingId =
    typeof parsed.data.listingId === "string" ? parsed.data.listingId : null;
  const addListingId =
    typeof parsed.data.addListingId === "string" ? parsed.data.addListingId : null;

  // Enforce property selection for real-estate clients (before save)
  {
    const { data: leadMeta } = await supabase
      .from("leads")
      .select("client_id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadMeta?.client_id) {
      const { data: clientMeta } = await supabase
        .from("clients")
        .select("business_type")
        .eq("id", leadMeta.client_id)
        .maybeSingle();
      if (clientMeta?.business_type === "real_estate" && !listingId && !addListingId) {
        return NextResponse.json(
          { error: "Please select which property this call was about", field: "listingId" },
          { status: 400 }
        );
      }
    }
  }

  let actorUserId: string;
  let actorName = "Unknown";
  let actorRole = "SALESPERSON";

  if (magicToken) {
    const { data: tokenLead } = await supabase
      .from("leads")
      .select("id, assigned_to_id, magic_token_expires_at")
      .eq("id", leadId)
      .eq("magic_token", magicToken)
      .maybeSingle();

    if (!tokenLead) {
      return NextResponse.json({ error: "Invalid magic token" }, { status: 403 });
    }
    const exp = tokenLead.magic_token_expires_at as string | null;
    if (exp && new Date(exp) < new Date()) {
      return NextResponse.json({ error: "Magic token expired" }, { status: 403 });
    }
    const assignee = tokenLead.assigned_to_id as string | null;
    if (!assignee) {
      return NextResponse.json({ error: "Lead has no assignee" }, { status: 403 });
    }
    actorUserId = assignee;

    const { data: actorForLog } = await supabase
      .from("users")
      .select("name, role")
      .eq("id", assignee)
      .maybeSingle();
    actorName = (actorForLog as { name: string } | null)?.name || "Unknown";
    actorRole = (actorForLog as { role: string } | null)?.role || "SALESPERSON";
  } else {
    const gate = await canModifyLead(leadId, req);
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason }, { status: gate.status });
    }
    const auth = await getAuthFromRequest(req);
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    actorUserId = auth.userId;
    actorRole = auth.role;

    const { data: actorForLog } = await supabase
      .from("users")
      .select("name")
      .eq("id", auth.userId)
      .maybeSingle();
    actorName = (actorForLog as { name: string } | null)?.name || "Unknown";
  }

  try {
    const saved = await saveCallLog({
      leadId,
      actorUserId,
      actor: { id: actorUserId, name: actorName, role: actorRole },
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
      listingId,
      addListingId,
    });

    return NextResponse.json({
      lead: saved.lead,
      legacyOutcome: saved.legacyOutcome,
      noAnswerCount: saved.noAnswerCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to log call";
    if (msg === "Lead not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[log-call]", err);
    return NextResponse.json({ error: "Failed to log call" }, { status: 500 });
  }
}
