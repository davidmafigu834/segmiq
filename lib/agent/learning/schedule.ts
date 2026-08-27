import { background } from "@/lib/background";
import { getLearningSettings } from "./settings";
import { isLearningFlagOn } from "./policy";
import { scheduleLearningJob } from "./jobs";
import type { LearningSource } from "./types";

/**
 * Fire-and-forget: never delay WhatsApp. Debounces conversation analysis
 * until the thread has been idle for the configured period.
 */
export function scheduleConversationLearning(opts: {
  clientId: string;
  conversationId: string;
  source?: LearningSource;
  immediate?: boolean;
  payload?: Record<string, unknown>;
}): void {
  background("segmiqLearningSchedule", async () => {
    const settings = await getLearningSettings(opts.clientId);
    if (!isLearningFlagOn(settings, "agent.learning.enabled")) return;
    if (!isLearningFlagOn(settings, "agent.learning.autoAnalyze") && !opts.immediate) return;
    const delayMs = opts.immediate ? 0 : settings.config.idleMinutes * 60_000;
    await scheduleLearningJob({
      clientId: opts.clientId,
      conversationId: opts.conversationId,
      source: opts.source ?? "CONVERSATION_SEGMENT",
      scheduledAt: new Date(Date.now() + delayMs),
      payload: opts.payload,
    });
  });
}
