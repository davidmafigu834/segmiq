import { assembleLearningContext } from "./context";
import { ingestObservation } from "./store";
import { compareObservation } from "./comparator";
import { scheduleLearningJob } from "./jobs";
import { getLearningSettings } from "./settings";
import { isLearningFlagOn, teachIntentToCategory, teachIntentToType } from "./policy";
import { recordLearningAudit } from "./audit";
import type { TeachIntent } from "./types";

export async function submitTeachSegmiq(opts: {
  clientId: string;
  conversationId: string;
  actorId: string;
  intent: TeachIntent;
  messageIds: string[];
  note?: string;
}): Promise<{ candidateId: string | null }> {
  const settings = await getLearningSettings(opts.clientId);
  if (!isLearningFlagOn(settings, "agent.learning.teach")) {
    throw new Error("Teach SegmiQ is turned off");
  }
  const ctx = await assembleLearningContext({
    clientId: opts.clientId,
    conversationId: opts.conversationId,
    limit: 30,
  });
  if (!ctx) throw new Error("Conversation not found");
  const selected = ctx.messages.filter((m) => opts.messageIds.includes(m.id));
  const excerpt = selected.map((m) => m.body).join(" ").slice(0, 400) || opts.note || "Taught from conversation";
  const type = teachIntentToType(opts.intent);
  const category = teachIntentToCategory(opts.intent);
  const observation = {
    type,
    category,
    title: opts.note?.slice(0, 80) || defaultTeachTitle(opts.intent),
    summary: excerpt.slice(0, 280),
    proposedLearning:
      opts.note?.trim() ||
      `When similar situations occur, follow the approach shown in this conversation: ${excerpt.slice(0, 240)}`,
    riskLevel: type === "CORRECTION" ? ("HIGH" as const) : ("MEDIUM" as const),
    evidenceMessageIds: opts.messageIds,
    confidence: "MEDIUM" as const,
  };
  const comparison = await compareObservation({
    clientId: opts.clientId,
    observation,
    context: ctx,
  });
  const result = await ingestObservation({
    clientId: opts.clientId,
    observation,
    comparison,
    conversationId: opts.conversationId,
    salespersonId: opts.actorId,
    customerId: ctx.customerId,
    dealId: ctx.deal?.id ?? null,
    source: "TEACH_SEGMIQ",
    excerpt,
    messageIds: opts.messageIds,
    forceSurface: true,
  });
  await scheduleLearningJob({
    clientId: opts.clientId,
    conversationId: opts.conversationId,
    source: "TEACH_SEGMIQ",
    fingerprint: `${opts.clientId}:${opts.conversationId}:TEACH:${opts.intent}:${opts.messageIds[0] ?? "none"}`,
    payload: { candidateId: result.id, intent: opts.intent },
    scheduledAt: new Date(),
  });
  await recordLearningAudit({
    clientId: opts.clientId,
    actorId: opts.actorId,
    action: "teach_submitted",
    entityType: "LEARNING_CANDIDATE",
    entityId: result.id,
    summary: observation.title,
  });
  return { candidateId: result.id };
}

function defaultTeachTitle(intent: TeachIntent): string {
  switch (intent) {
    case "GOOD_RESPONSE":
      return "Remember this response approach";
    case "WRONG_RESPONSE":
      return "Do not repeat this response";
    case "REMEMBER_APPROACH":
      return "Sales approach to remember";
    case "NEVER_RESPOND_THIS_WAY":
      return "Avoid this response style";
    case "ADD_AS_FAQ":
      return "FAQ from team conversation";
    case "ADD_TO_PLAYBOOK":
      return "Qualification step from team";
    case "ADD_TERMINOLOGY":
      return "Customer terminology";
  }
}
