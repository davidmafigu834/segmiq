import { z } from "zod";
import { getAgentModelProvider } from "@/lib/agent/provider";
import { sanitizeConfigText } from "@/lib/agent/prompt";
import type { EvaluationContext } from "./context";
import type { ProactiveDecisionContract, ProactiveJob } from "./types";
import { TEMPORAL_TRIGGER_TYPES } from "./registry";

const outputSchema = z.object({
  decision: z.enum([
    "NO_ACTION",
    "SEND_MESSAGE",
    "CREATE_TASK",
    "NOTIFY_HUMAN",
    "ESCALATE",
    "PREPARE_WORK",
  ]),
  reasonCode: z.string().max(80),
  customerMessage: z.string().max(700).optional(),
  task: z
    .object({
      title: z.string().max(200),
      dueAt: z.string().optional(),
      priority: z.string().optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(400),
});

/**
 * Short structured decision for conversational follow-ups.
 * Templates cover reminders. This is only called after deterministic policy allows it.
 */
export async function generateProactiveDecision(opts: {
  job: ProactiveJob;
  ctx: EvaluationContext;
  timezone: string;
}): Promise<ProactiveDecisionContract | null> {
  const provider = getAgentModelProvider();
  const facts = [
    `Trigger: ${opts.job.triggerType} (attempt ${opts.job.attemptNumber})`,
    `Customer first name: ${opts.ctx.customerFirstName}`,
    opts.ctx.quotation
      ? `Quotation ${opts.ctx.quotation.quoteNumber ?? opts.ctx.quotation.id} status=${opts.ctx.quotation.status} version=${opts.ctx.quotation.revisionNumber}`
      : null,
    opts.ctx.projectHint ? `Project: ${opts.ctx.projectHint}` : null,
    opts.job.triggerType === TEMPORAL_TRIGGER_TYPES.CUSTOMER_FOLLOWUP_DUE
      ? "The customer explicitly asked to be contacted today. Be direct about that — do not pretend this is a generic check-in."
      : null,
    "Only mention facts listed here. Do not invent project names, prices, locations, or urgency.",
    "Do not use last-chance, act-now, or accusatory language.",
    "Keep the WhatsApp message to 1–3 short sentences.",
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You write a brief SegmiQ Agent follow-up decision as JSON only. You do not execute tools. You never invent facts. Policy has already allowed a customer message. Return JSON:
{"decision":"SEND_MESSAGE","reasonCode":"NO_ACTION_NEEDED","customerMessage":"...","confidence":0.0-1.0,"summary":"one sentence"}
If you should not message after all, decision NO_ACTION.`;

  const response = await provider.generate({
    system,
    messages: [{ role: "user", text: sanitizeConfigText(facts, 2000) }],
    maxTokens: 400,
    temperature: 0.3,
  });
  const text = (response.text ?? "").trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  const parsed = outputSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  return {
    decision: parsed.data.decision,
    reasonCode: (parsed.data.reasonCode as ProactiveDecisionContract["reasonCode"]) || "NO_ACTION_NEEDED",
    customerMessage: parsed.data.customerMessage,
    task: parsed.data.task
      ? { title: parsed.data.task.title, dueAt: parsed.data.task.dueAt, priority: parsed.data.task.priority }
      : undefined,
    confidence: parsed.data.confidence,
    summary: parsed.data.summary,
  };
}
