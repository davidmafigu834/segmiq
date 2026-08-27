import { createAdminClient } from "@/lib/supabase/admin";
import { logLeadEvent } from "@/lib/lead-events";
import { assembleLearningContext } from "./context";
import { extractLearningObservations } from "./extractor";
import { compareObservation } from "./comparator";
import { ingestObservation } from "./store";
import {
  claimDueLearningJobs,
  countTodayTokens,
  finishLearningJob,
  getLearningCursor,
  recoverStuckLearningJobs,
  retryLearningJob,
  upsertLearningCursor,
} from "./jobs";
import { getLearningSettings } from "./settings";
import {
  classifyEdit,
  evaluateEligibility,
  isLearningFlagOn,
  isLearningGloballyEnabled,
  isMeaningfulCorrection,
} from "./policy";
import { notifyLearningReview } from "./notifications";
import type { LearningSkipReason } from "./types";
import { LEARNING_PROMPT_VERSION } from "./types";

async function isExcluded(clientId: string, conversationId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_learning_exclusions")
    .select("conversation_id")
    .eq("client_id", clientId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  return Boolean(data);
}

export async function runLearningWorker(): Promise<{ claimed: number; completed: number; skipped: number; failed: number }> {
  if (!isLearningGloballyEnabled()) {
    return { claimed: 0, completed: 0, skipped: 0, failed: 0 };
  }
  await recoverStuckLearningJobs();
  const jobs = await claimDueLearningJobs(6);
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  for (const job of jobs) {
    const started = Date.now();
    try {
      if (!job.conversationId) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "UNSUPPORTED_SOURCE" });
        skipped += 1;
        continue;
      }
      const settings = await getLearningSettings(job.clientId);
      if (!isLearningFlagOn(settings, "agent.learning.enabled")) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "LEARNING_DISABLED" });
        skipped += 1;
        continue;
      }
      const tokensToday = await countTodayTokens(job.clientId);
      if (tokensToday >= settings.config.dailyTokenBudget) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "TENANT_BUDGET" });
        skipped += 1;
        continue;
      }
      if (await isExcluded(job.clientId, job.conversationId)) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "CONVERSATION_EXCLUDED" });
        skipped += 1;
        continue;
      }

      if (job.source === "TEACH_SEGMIQ" && job.payload?.candidateId) {
        await finishLearningJob(job.id, { status: "COMPLETED", latencyMs: Date.now() - started });
        completed += 1;
        continue;
      }

      if (job.source === "HUMAN_CORRECTION" && job.payload?.edited) {
        if (!settings.config.copilotEdits) {
          await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "SOURCE_DISABLED" });
          skipped += 1;
          continue;
        }
        const original = String(job.payload.original ?? "");
        const edited = String(job.payload.edited ?? "");
        const editClass = classifyEdit(original, edited);
        if (!isMeaningfulCorrection(editClass)) {
          await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "INSUFFICIENT_CONTENT" });
          skipped += 1;
          continue;
        }
        const correctionCtx = await assembleLearningContext({
          clientId: job.clientId,
          conversationId: job.conversationId,
          afterMessageId: null,
          limit: 20,
        });
        if (!correctionCtx) {
          await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "UNSUPPORTED_SOURCE" });
          skipped += 1;
          continue;
        }
        const category =
          editClass === "COMMERCIAL_CORRECTION"
            ? ("COMMERCIAL_PATTERN" as const)
            : editClass === "TECHNICAL_CORRECTION"
              ? ("PRODUCT_EXPLANATION" as const)
              : editClass === "POLICY_CORRECTION"
                ? ("ESCALATION" as const)
                : ("PRODUCT_EXPLANATION" as const);
        const observation = {
          type: "CORRECTION" as const,
          category,
          title: "Human correction of Agent draft",
          summary: "A salesperson substantially edited an Agent-generated reply before sending.",
          proposedLearning: `Prefer the human-corrected approach rather than the original Agent draft. Corrected reply: ${edited.slice(0, 500)}`,
          riskLevel: editClass === "COMMERCIAL_CORRECTION" ? ("VERY_HIGH" as const) : ("HIGH" as const),
          evidenceMessageIds: [],
          confidence: "MEDIUM" as const,
        };
        const comparison = await compareObservation({
          clientId: job.clientId,
          observation,
          context: correctionCtx,
        });
        await ingestObservation({
          clientId: job.clientId,
          observation,
          comparison,
          conversationId: job.conversationId,
          salespersonId: correctionCtx.salespersonId,
          customerId: correctionCtx.customerId,
          dealId: correctionCtx.deal?.id ?? null,
          source: "HUMAN_CORRECTION",
          excerpt: `Draft: ${original.slice(0, 140)} → Sent: ${edited.slice(0, 140)}`,
          messageIds: [],
          forceSurface: true,
        });
        await finishLearningJob(job.id, { status: "COMPLETED", latencyMs: Date.now() - started });
        completed += 1;
        continue;
      }

      const cursor = await getLearningCursor(job.clientId, job.conversationId);
      const ctx = await assembleLearningContext({
        clientId: job.clientId,
        conversationId: job.conversationId,
        afterMessageId: cursor?.lastAnalyzedMessageId ?? null,
      });
      if (!ctx) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "UNSUPPORTED_SOURCE" });
        skipped += 1;
        continue;
      }

      const human = ctx.messages.filter((m) => m.origin === "HUMAN_SALESPERSON");
      const customer = ctx.messages.filter((m) => m.origin === "CUSTOMER");
      const eligibility = evaluateEligibility({
        learningEnabled: settings.enabled,
        globallyEnabled: true,
        autoAnalyze: settings.config.autoAnalyze,
        excluded: false,
        conversationType: ctx.conversationType,
        salesSourceOn: settings.config.sales,
        supportSourceOn: settings.config.support,
        humanMessageCount: human.length,
        meaningfulCharCount: ctx.messages.reduce((n, m) => n + m.body.length, 0),
        hasCustomerMessage: customer.length > 0,
        entirelyAgentGenerated: human.length === 0 && ctx.messages.every((m) => m.origin === "AGENT" || m.origin === "SYSTEM"),
        systemOnly: ctx.messages.every((m) => m.origin === "SYSTEM"),
        privateConversation: false,
        minHumanMessages: settings.config.minHumanMessages,
        minMeaningfulChars: settings.config.minMeaningfulChars,
      });
      if (!eligibility.eligible) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: eligibility.reason as LearningSkipReason });
        skipped += 1;
        continue;
      }

      if (ctx.messages.length === 0) {
        await finishLearningJob(job.id, { status: "SKIPPED", skipReason: "NO_ELIGIBLE_MESSAGES" });
        skipped += 1;
        continue;
      }

      const extracted = await extractLearningObservations(ctx);
      let createdOrTouched = 0;
      for (const observation of extracted.output.observations) {
        const comparison = await compareObservation({
          clientId: job.clientId,
          observation,
          context: ctx,
        });
        const result = await ingestObservation({
          clientId: job.clientId,
          observation,
          comparison,
          conversationId: job.conversationId,
          salespersonId: human[0]?.actorId ?? ctx.salespersonId,
          customerId: ctx.customerId,
          dealId: ctx.deal?.id ?? null,
          source: job.source,
          excerpt: ctx.messages
            .filter((m) => observation.evidenceMessageIds.includes(m.id) || m.origin === "HUMAN_SALESPERSON")
            .slice(0, 3)
            .map((m) => m.body)
            .join(" · ")
            .slice(0, 320),
          messageIds: observation.evidenceMessageIds.length
            ? observation.evidenceMessageIds
            : ctx.messages.map((m) => m.id),
          segmentStartId: ctx.messages[0]?.id ?? null,
          segmentEndId: ctx.messages[ctx.messages.length - 1]?.id ?? null,
        });
        if (result.id) createdOrTouched += 1;
        if (result.action === "created" && result.id) {
          await notifyLearningReview({
            clientId: job.clientId,
            candidateId: result.id,
            title: observation.title,
            riskLevel: observation.riskLevel,
            comparisonState: comparison.state,
            isCorrection: observation.type === "CORRECTION",
          });
          if (observation.category === "QUALIFICATION" || observation.category === "FAQ") {
            await logLeadEvent({
              leadId: job.conversationId,
              clientId: job.clientId,
              actor: { id: null, name: "SegmiQ", role: "SYSTEM" },
              eventType: "LEARNING_OBSERVED",
              eventData: {
                candidateId: result.id,
                category: observation.category,
                title: observation.title,
                summary: observation.summary,
              },
            });
          }
        }
      }

      const last = ctx.messages[ctx.messages.length - 1];
      if (last) {
        await upsertLearningCursor({
          clientId: job.clientId,
          conversationId: job.conversationId,
          messageId: last.id,
          jobId: job.id,
        });
      }

      await finishLearningJob(job.id, {
        status: "COMPLETED",
        inputTokens: extracted.usage.inputTokens,
        outputTokens: extracted.usage.outputTokens,
        latencyMs: Date.now() - started,
        modelVersion: extracted.model,
        promptVersion: LEARNING_PROMPT_VERSION,
      });
      completed += 1;
      void createdOrTouched;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[learning] job failed", job.id, message);
      if (job.retryCount < 3) {
        await retryLearningJob(job.id, job.retryCount);
      } else {
        await finishLearningJob(job.id, { status: "FAILED", failureReason: message.slice(0, 400) });
      }
      failed += 1;
    }
  }
  return { claimed: jobs.length, completed, skipped, failed };
}

export async function excludeConversation(opts: {
  clientId: string;
  conversationId: string;
  actorId: string;
  reason?: string | null;
  note?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_learning_exclusions").upsert(
    {
      client_id: opts.clientId,
      conversation_id: opts.conversationId,
      excluded_by: opts.actorId,
      excluded_at: new Date().toISOString(),
      reason: opts.reason ?? "OTHER",
      note: opts.note ?? null,
    },
    { onConflict: "client_id,conversation_id" }
  );
}

export async function isConversationExcluded(clientId: string, conversationId: string): Promise<boolean> {
  return isExcluded(clientId, conversationId);
}
