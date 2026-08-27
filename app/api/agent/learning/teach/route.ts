import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireConversationLearningAccess } from "@/lib/agent/learning/access";
import { submitTeachSegmiq } from "@/lib/agent/learning/teach";
import { TEACH_INTENTS } from "@/lib/agent/learning/types";
import { asRow } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadId: z.string().uuid(),
  intent: z.enum(TEACH_INTENTS),
  messageIds: z.array(z.string()).max(20).default([]),
  note: z.string().max(800).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid teach request" }, { status: 400 });
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id")
    .eq("id", parsed.data.leadId)
    .maybeSingle();
  const lead = asRow<{ id: string; client_id: string; assigned_to_id: string | null }>(data);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireConversationLearningAccess(
    req,
    lead.client_id,
    lead.assigned_to_id,
    "agent.learning.submit"
  );
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const result = await submitTeachSegmiq({
      clientId: access.clientId,
      conversationId: parsed.data.leadId,
      actorId: access.userId,
      intent: parsed.data.intent,
      messageIds: parsed.data.messageIds,
      note: parsed.data.note,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not submit learning" },
      { status: 400 }
    );
  }
}
