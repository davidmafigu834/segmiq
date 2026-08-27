import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireConversationLearningAccess } from "@/lib/agent/learning/access";
import { getLearningSettings } from "@/lib/agent/learning/settings";
import { conversationLearningSummary } from "@/lib/agent/learning/store";
import { excludeConversation, isConversationExcluded } from "@/lib/agent/learning/worker";
import { EXCLUSION_REASONS } from "@/lib/agent/learning/types";
import { asRow } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

async function loadLead(leadId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id")
    .eq("id", leadId)
    .maybeSingle();
  return asRow<{ id: string; client_id: string; assigned_to_id: string | null }>(data);
}

export async function GET(req: Request, { params }: { params: { leadId: string } }) {
  const lead = await loadLead(params.leadId);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireConversationLearningAccess(
    req,
    lead.client_id,
    lead.assigned_to_id,
    "agent.learning.view"
  );
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const [settings, excluded, summary] = await Promise.all([
    getLearningSettings(access.clientId),
    isConversationExcluded(access.clientId, params.leadId),
    conversationLearningSummary(access.clientId, params.leadId),
  ]);
  return NextResponse.json({
    learningEnabled: settings.enabled,
    excluded,
    indicators: settings.config.indicators,
    ...summary,
  });
}

const excludeSchema = z.object({
  reason: z.enum(EXCLUSION_REASONS).optional(),
  note: z.string().max(300).optional(),
});

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const lead = await loadLead(params.leadId);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireConversationLearningAccess(
    req,
    lead.client_id,
    lead.assigned_to_id,
    "agent.learning.excludeConversation"
  );
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = excludeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await excludeConversation({
    clientId: access.clientId,
    conversationId: params.leadId,
    actorId: access.userId,
    reason: parsed.data.reason ?? "OTHER",
    note: parsed.data.note ?? null,
  });
  return NextResponse.json({ ok: true });
}
