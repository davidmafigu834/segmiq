import { NextResponse } from "next/server";
import { z } from "zod";
import { requireLearningAccess } from "@/lib/agent/learning/access";
import {
  approveCandidate,
  getCandidate,
  listEvidence,
  rejectCandidate,
} from "@/lib/agent/learning/store";
import { LEARNING_DESTINATIONS, MANAGER_LEARNING_FEEDBACK } from "@/lib/agent/learning/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireLearningAccess(req, "agent.learning.view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const candidate = await getCandidate(access.clientId, params.id);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const evidence = await listEvidence(access.clientId, candidate.id);
  return NextResponse.json({ candidate, evidence });
}

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "merge"]),
  content: z.string().max(2000).optional(),
  destination: z.enum(LEARNING_DESTINATIONS).optional(),
  destinationId: z.string().uuid().nullable().optional(),
  mergeIntoKnowledgeId: z.string().uuid().optional(),
  reason: z.string().max(400).optional(),
  feedback: z.enum(MANAGER_LEARNING_FEEDBACK).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 });

  const permission =
    parsed.data.action === "reject" ? "agent.learning.reject" : "agent.learning.approve";
  const access = await requireLearningAccess(req, permission);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  if (parsed.data.action === "reject") {
    await rejectCandidate({
      clientId: access.clientId,
      candidateId: params.id,
      actorId: access.userId,
      reason: parsed.data.reason ?? null,
      feedback: parsed.data.feedback ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  const knowledge = await approveCandidate({
    clientId: access.clientId,
    candidateId: params.id,
    actorId: access.userId,
    content: parsed.data.content,
    destination: parsed.data.destination,
    destinationId: parsed.data.destinationId,
    mergeIntoKnowledgeId: parsed.data.action === "merge" ? parsed.data.mergeIntoKnowledgeId : null,
  });
  return NextResponse.json({ ok: true, knowledge });
}
