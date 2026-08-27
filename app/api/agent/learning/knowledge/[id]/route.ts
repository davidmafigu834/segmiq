import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningAccess } from "@/lib/agent/learning/access";
import { deactivateKnowledge, getKnowledge, listKnowledge, updateKnowledge } from "@/lib/agent/learning/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireLearningAccess(req, "agent.learning.view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const knowledge = await getKnowledge(access.clientId, params.id);
  if (!knowledge) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = createAdminClient();
  const { data: versions } = await supabase
    .from("agent_learning_knowledge_versions")
    .select("id, title, content, changed_by, created_at, change_summary")
    .eq("client_id", access.clientId)
    .eq("knowledge_id", knowledge.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ knowledge, versions: asRows(versions) });
}

const patchSchema = z.object({
  action: z.enum(["deactivate", "edit"]),
  title: z.string().max(160).optional(),
  content: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const access = await requireLearningAccess(req, "agent.learning.manage");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (parsed.data.action === "deactivate") {
    await deactivateKnowledge({ clientId: access.clientId, knowledgeId: params.id, actorId: access.userId });
    return NextResponse.json({ ok: true });
  }
  if (!parsed.data.content) return NextResponse.json({ error: "content required" }, { status: 400 });
  await updateKnowledge({
    clientId: access.clientId,
    knowledgeId: params.id,
    actorId: access.userId,
    title: parsed.data.title,
    content: parsed.data.content,
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const access = await requireLearningAccess(req, "agent.learning.view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const knowledge = await listKnowledge(access.clientId);
  return NextResponse.json({ knowledge });
}
