import { createAdminClient } from "@/lib/supabase/admin";
import { sendCanonicalWhatsAppText } from "@/lib/whatsapp/message-service";
import {
  acquireConversationLock,
  conversationAllowsAgent,
  ensureConversationAgentState,
  releaseConversationLock,
  updateConversationAgentState,
} from "./conversation-state";
import { assembleAgentContext, type AgentContext } from "./context";
import { createAgentEscalation } from "./escalation";
import { notifyOwnerOrManagers } from "./notifications";
import { canSendCustomerReply, evaluateBusinessHours, evaluateToolPolicy } from "./policy";
import {
  AGENT_PROMPT_VERSION,
  buildContextMessage,
  buildSystemPrompt,
  parseAgentFinalOutput,
  type AgentFinalOutput,
} from "./prompt";
import { getAgentModelProvider, type AgentChatMessage, type ModelToolCall } from "./provider";
import { getAgentCompanySettings, isAgentGloballyEnabled } from "./settings";
import { runAgentTool, type ExecutedToolCall } from "./tools/execute";
import { ASSIST_SAFE_TOOLS, TOOL_METADATA, buildToolDefinitions, type AgentToolName } from "./tools/registry";
import type { ToolExecutionContext } from "./tools/context";
import type { AgentCompanySettings, InboundConversationEvent } from "./types";
import { asRow } from "./rows";

/**
 * AgentRuntime — receives conversation events, decides whether the agent
 * should act, owns the execution lock, drives the reasoning/tool loop, sends
 * the reply through the canonical WhatsApp layer and persists audit records.
 */

const MAX_MODEL_TURNS = 8;
const MAX_TOOL_CALLS = 14;
const MAX_RUN_MS = 120_000;

function log(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "agent", event, ...data }));
}

// ---------------------------------------------------------------------------
// Entry point — called (via background()) after an inbound message persists.

export async function handleAgentInboundMessage(event: InboundConversationEvent): Promise<void> {
  try {
    if (!isAgentGloballyEnabled()) return;

    const settings = await getAgentCompanySettings(event.clientId);
    if (!settings.enabled) return;
    if (!settings.respondToEnquiries) return;

    await updateConversationAgentState(event.clientId, event.leadId, {
      lastCustomerMessageAt: event.timestamp,
    });

    const state = await ensureConversationAgentState(event.clientId, event.leadId);
    const gate = conversationAllowsAgent(state);
    if (!gate.allowed) {
      log("skip.conversation_gate", { leadId: event.leadId, reason: gate.reason });
      return;
    }

    // Human takeover: a team member replied recently — the human is handling.
    if (await humanRepliedRecently(event.clientId, event.leadId)) {
      await updateConversationAgentState(event.clientId, event.leadId, { status: "HUMAN_HANDLING" });
      log("skip.human_handling", { leadId: event.leadId });
      return;
    }

    // Aggregation window: rapid consecutive messages collapse into one run.
    if (settings.debounceSeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, settings.debounceSeconds * 1000));
      const newest = await latestInboundMessageId(event.clientId, event.leadId);
      if (newest && newest !== event.messageId) {
        log("skip.debounced", { leadId: event.leadId, supersededBy: newest });
        return;
      }
    }

    const rate = await checkRateLimits(event.clientId, event.leadId, settings);
    if (!rate.ok) {
      log("skip.rate_limited", { leadId: event.leadId, which: rate.which });
      if (rate.which === "conversation") {
        await createAgentEscalation({
          clientId: event.clientId,
          leadId: event.leadId,
          executionId: null,
          reason: "RATE_LIMITED",
          summary:
            "The agent hit the per-conversation rate limit (possible loop or very rapid messages). A human should review this thread.",
          ownerId: event.ownerId,
          escalationUserId: settings.escalationUserId,
        });
      }
      return;
    }

    const hoursDecision = evaluateBusinessHours(settings, await conversationTimezone(event.clientId));
    if (hoursDecision === "SUPPRESS") {
      log("skip.outside_business_hours", { leadId: event.leadId });
      return;
    }

    await runAgentExecution({
      clientId: event.clientId,
      leadId: event.leadId,
      triggerMessageId: event.messageId,
      settings,
      afterHoursAck: hoursDecision === "AFTER_HOURS_ACK",
      testMode: settings.testMode,
      retryOnStaleContext: true,
    });
  } catch (err) {
    console.error("[agent] inbound handling failed", err);
  }
}

async function conversationTimezone(clientId: string): Promise<string> {
  const { resolveClientSalesTimezone } = await import(
    "@/lib/sales/intelligence/daily-plan-service"
  );
  return resolveClientSalesTimezone(clientId);
}

async function humanRepliedRecently(clientId: string, leadId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("direction", "outbound")
    .eq("sender_source", "SEGMIQ_USER")
    .gte("created_at", cutoff)
    .limit(1);
  return Boolean(data?.length);
}

async function latestInboundMessageId(clientId: string, leadId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | null) ?? null;
}

async function checkRateLimits(
  clientId: string,
  leadId: string,
  settings: AgentCompanySettings
): Promise<{ ok: true } | { ok: false; which: "company" | "conversation" }> {
  const supabase = createAdminClient();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [{ count: companyToday }, { count: conversationHour }] = await Promise.all([
    supabase
      .from("agent_executions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("created_at", dayStart.toISOString()),
    supabase
      .from("agent_executions")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .gte("created_at", hourAgo),
  ]);

  if ((companyToday ?? 0) >= settings.dailyExecutionLimit) return { ok: false, which: "company" };
  if ((conversationHour ?? 0) >= settings.conversationHourlyLimit) {
    return { ok: false, which: "conversation" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Execution.

type RunOptions = {
  clientId: string;
  leadId: string;
  triggerMessageId: string | null;
  settings: AgentCompanySettings;
  afterHoursAck: boolean;
  testMode: boolean;
  retryOnStaleContext: boolean;
  /** Simulation only: extra customer message appended to the transcript. */
  simulatedCustomerMessage?: string;
};

export type AgentRunResult = {
  executionId: string | null;
  state: string;
  reply: string | null;
  replyStatus: string | null;
  intents: string[];
  confidence: number | null;
  decisionSummary: string | null;
  actions: Array<{
    toolName: string;
    status: string;
    riskLevel: string;
    summary: Record<string, unknown>;
  }>;
};

export async function runAgentExecution(opts: RunOptions): Promise<AgentRunResult> {
  const supabase = createAdminClient();
  const startedAt = Date.now();

  // Execution record first — the unique trigger index is the replay guard.
  const { data: executionData, error: executionError } = await supabase
    .from("agent_executions")
    .insert({
      client_id: opts.clientId,
      lead_id: opts.leadId,
      trigger_message_id: opts.triggerMessageId,
      state: "QUEUED",
      autonomy_mode: opts.settings.autonomyMode,
      prompt_version: AGENT_PROMPT_VERSION,
      test_mode: opts.testMode,
    })
    .select("id")
    .single();
  const execution = asRow<{ id: string }>(executionData);
  if (executionError || !execution) {
    if (executionError?.code === "23505") {
      log("skip.duplicate_trigger", { leadId: opts.leadId, trigger: opts.triggerMessageId });
    } else {
      console.error("[agent] failed to create execution", executionError);
    }
    return emptyResult(null, "SKIPPED");
  }
  const executionId = execution.id;

  const locked = await acquireConversationLock({
    clientId: opts.clientId,
    leadId: opts.leadId,
    executionId,
  });
  if (!locked) {
    await finishExecution(executionId, { state: "SKIPPED", error_code: "LOCK_HELD" });
    log("skip.lock_held", { leadId: opts.leadId, executionId });
    return emptyResult(executionId, "SKIPPED");
  }

  try {
    await supabase
      .from("agent_executions")
      .update({ state: "RUNNING", started_at: new Date().toISOString() })
      .eq("id", executionId);
    if (!opts.testMode) {
      await updateConversationAgentState(opts.clientId, opts.leadId, { status: "AI_HANDLING" });
    }

    const context = await assembleAgentContext({
      clientId: opts.clientId,
      leadId: opts.leadId,
      settings: opts.settings,
    });
    if (!context) {
      await finishExecution(executionId, { state: "FAILED", error_code: "CONTEXT_UNAVAILABLE" });
      return emptyResult(executionId, "FAILED");
    }
    await supabase
      .from("agent_executions")
      .update({ context_version: context.conversation.latestMessageId })
      .eq("id", executionId);

    const outcome = await reasonAndAct({ ...opts, executionId, context });

    // Persist final execution record.
    await finishExecution(executionId, {
      state: outcome.executionState,
      intents: outcome.final?.intents ?? [],
      confidence: outcome.final?.confidence ?? null,
      decision_summary: outcome.final?.decisionSummary ?? null,
      evidence: outcome.final?.evidence ?? null,
      customer_reply: outcome.reply,
      reply_status: outcome.replyStatus,
      model: outcome.model,
      input_tokens: outcome.inputTokens,
      output_tokens: outcome.outputTokens,
      tool_call_count: outcome.toolCalls.length,
      latency_ms: Date.now() - startedAt,
      error_code: outcome.errorCode ?? null,
      error_message: outcome.errorMessage ?? null,
    });

    // Stale context: a newer customer message (or human reply) invalidated the
    // run before send. Re-evaluate once with fresh context.
    if (outcome.executionState === "CANCELLED" && outcome.staleRerun && opts.retryOnStaleContext) {
      await releaseConversationLock({ clientId: opts.clientId, leadId: opts.leadId, executionId });
      log("rerun.stale_context", { leadId: opts.leadId, executionId });
      return runAgentExecution({
        ...opts,
        triggerMessageId: await latestInboundMessageId(opts.clientId, opts.leadId),
        retryOnStaleContext: false,
      });
    }

    if (!opts.testMode && outcome.replyStatus === "SENT") {
      await updateConversationAgentState(opts.clientId, opts.leadId, {
        status: "WAITING_ON_CUSTOMER",
        lastAgentMessageAt: new Date().toISOString(),
      });
    }

    return {
      executionId,
      state: outcome.executionState,
      reply: outcome.reply,
      replyStatus: outcome.replyStatus,
      intents: outcome.final?.intents ?? [],
      confidence: outcome.final?.confidence ?? null,
      decisionSummary: outcome.final?.decisionSummary ?? null,
      actions: outcome.toolCalls.map((c) => ({
        toolName: c.toolName,
        status: c.status,
        riskLevel: c.riskLevel,
        summary: c.result.summary,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent] execution failed", err);
    await finishExecution(executionId, {
      state: "FAILED",
      error_code: "RUNTIME_ERROR",
      error_message: message.slice(0, 500),
      latency_ms: Date.now() - startedAt,
    });
    if (!opts.testMode) {
      await createAgentEscalation({
        clientId: opts.clientId,
        leadId: opts.leadId,
        executionId,
        reason: "SYSTEM_FAILURE",
        summary: `The agent run failed (${message.slice(0, 200)}). The customer's message has NOT been answered.`,
        ownerId: null,
        escalationUserId: opts.settings.escalationUserId,
      });
    }
    return emptyResult(executionId, "FAILED");
  } finally {
    await releaseConversationLock({ clientId: opts.clientId, leadId: opts.leadId, executionId });
  }
}

function emptyResult(executionId: string | null, state: string): AgentRunResult {
  return {
    executionId,
    state,
    reply: null,
    replyStatus: null,
    intents: [],
    confidence: null,
    decisionSummary: null,
    actions: [],
  };
}

async function finishExecution(
  executionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_executions")
    .update({ ...patch, completed_at: new Date().toISOString() })
    .eq("id", executionId);
}

// ---------------------------------------------------------------------------
// Reasoning loop.

type ReasonOutcome = {
  executionState: "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_FOR_HUMAN";
  final: AgentFinalOutput | null;
  reply: string | null;
  replyStatus: "SENT" | "DRAFTED" | "SUPPRESSED" | "FAILED" | null;
  toolCalls: ExecutedToolCall[];
  inputTokens: number;
  outputTokens: number;
  model: string;
  errorCode?: string;
  errorMessage?: string;
  staleRerun?: boolean;
};

async function reasonAndAct(
  opts: RunOptions & { executionId: string; context: AgentContext }
): Promise<ReasonOutcome> {
  const supabase = createAdminClient();
  const provider = getAgentModelProvider();
  const { context, settings } = opts;

  const toolCtx: ToolExecutionContext = {
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: context.contactId,
    ownerId: context.lead.ownerId,
    ownerName: context.lead.ownerName,
    executionId: opts.executionId,
    timezone: context.company.timezone,
    settings,
    testMode: opts.testMode,
  };

  // Expose only tools the current policy could ever allow, so the model does
  // not plan around unavailable actions.
  const availableTools = (Object.keys(TOOL_METADATA) as AgentToolName[]).filter((name) => {
    if (settings.autonomyMode === "ASSIST") return ASSIST_SAFE_TOOLS.has(name);
    return evaluateToolPolicy(TOOL_METADATA[name], settings).allowed;
  });

  const system = buildSystemPrompt({ settings, companyName: context.company.name });
  let contextMessage = buildContextMessage({ context, afterHoursAck: opts.afterHoursAck });
  if (opts.simulatedCustomerMessage) {
    contextMessage += `\n\n[CUSTOMER] ${opts.simulatedCustomerMessage}`;
  }

  const messages: AgentChatMessage[] = [{ role: "user", text: contextMessage }];
  const executedCalls: ExecutedToolCall[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let model = provider.modelId;
  const deadline = Date.now() + MAX_RUN_MS;

  let finalText: string | null = null;
  for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
    if (Date.now() > deadline || executedCalls.length >= MAX_TOOL_CALLS) {
      log("loop_limit", { executionId: opts.executionId, turn, toolCalls: executedCalls.length });
      break;
    }

    const response = await provider.generate({
      system,
      messages,
      tools: buildToolDefinitions(availableTools),
      maxTokens: 1600,
    });
    inputTokens += response.usage.inputTokens;
    outputTokens += response.usage.outputTokens;
    model = response.model;

    if (response.stopReason !== "tool_use" || !response.toolCalls.length) {
      finalText = response.text;
      break;
    }

    messages.push({ role: "assistant", text: response.text, toolCalls: response.toolCalls });
    const results = await executeToolBatch(toolCtx, response.toolCalls, executedCalls, opts);
    messages.push({ role: "toolResult", results });
  }

  // Loop limit reached without a final answer.
  if (finalText === null && executedCalls.length >= MAX_TOOL_CALLS) {
    if (!opts.testMode) {
      await createAgentEscalation({
        clientId: opts.clientId,
        leadId: opts.leadId,
        executionId: opts.executionId,
        reason: "SYSTEM_FAILURE",
        summary:
          "The agent hit its tool-call limit without completing. A human should review the conversation and the actions already taken.",
        ownerId: context.lead.ownerId,
        escalationUserId: settings.escalationUserId,
      });
    }
    return {
      executionState: "WAITING_FOR_HUMAN",
      final: null,
      reply: null,
      replyStatus: "SUPPRESSED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
      errorCode: "LOOP_LIMIT",
    };
  }

  // Parse structured final output, with one repair attempt.
  let final = parseAgentFinalOutput(finalText);
  if (!final) {
    const repair = await provider.generate({
      system,
      messages: [
        ...messages,
        ...(finalText ? [{ role: "assistant" as const, text: finalText, toolCalls: [] }] : []),
        {
          role: "user",
          text: "Your last message was not the required JSON object. Respond now with ONLY the final JSON object described in your instructions.",
        },
      ],
      tools: buildToolDefinitions(availableTools),
      maxTokens: 800,
    });
    inputTokens += repair.usage.inputTokens;
    outputTokens += repair.usage.outputTokens;
    final = parseAgentFinalOutput(repair.text);
  }
  if (!final) {
    if (!opts.testMode) {
      await createAgentEscalation({
        clientId: opts.clientId,
        leadId: opts.leadId,
        executionId: opts.executionId,
        reason: "SYSTEM_FAILURE",
        summary: "The agent could not produce a valid response for this customer message.",
        ownerId: context.lead.ownerId,
        escalationUserId: settings.escalationUserId,
      });
    }
    return {
      executionState: "FAILED",
      final: null,
      reply: null,
      replyStatus: null,
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
      errorCode: "INVALID_MODEL_OUTPUT",
    };
  }

  const escalated = executedCalls.some(
    (c) => c.toolName === "agent_escalate" && (c.status === "EXECUTED" || c.status === "SIMULATED")
  );

  // Low confidence without an explicit escalation → stop and escalate.
  if (final.confidence < 0.3 && !escalated && !opts.testMode) {
    await createAgentEscalation({
      clientId: opts.clientId,
      leadId: opts.leadId,
      executionId: opts.executionId,
      reason: "LOW_CONFIDENCE",
      summary: `Low confidence (${final.confidence.toFixed(2)}): ${final.decisionSummary}`,
      briefing: final.evidence ? { evidence: final.evidence } : null,
      ownerId: context.lead.ownerId,
      escalationUserId: settings.escalationUserId,
    });
    return {
      executionState: "WAITING_FOR_HUMAN",
      final,
      reply: final.reply,
      replyStatus: "SUPPRESSED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
    };
  }

  // Simulation: never send.
  if (opts.testMode) {
    return {
      executionState: "COMPLETED",
      final,
      reply: final.reply,
      replyStatus: final.reply ? "SUPPRESSED" : null,
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
    };
  }

  if (!final.reply) {
    return {
      executionState: escalated ? "WAITING_FOR_HUMAN" : "COMPLETED",
      final,
      reply: null,
      replyStatus: null,
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
    };
  }

  // ASSIST: draft only — notify the owner to review, never auto-send.
  if (!canSendCustomerReply(settings)) {
    await notifyOwnerOrManagers({
      clientId: opts.clientId,
      ownerId: context.lead.ownerId,
      leadId: opts.leadId,
      message: `SegmiQ Agent drafted a reply for review: "${final.reply.slice(0, 120)}"`,
    });
    return {
      executionState: escalated ? "WAITING_FOR_HUMAN" : "COMPLETED",
      final,
      reply: final.reply,
      replyStatus: "DRAFTED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
    };
  }

  // Context-version guard: cancel a stale reply instead of sending it.
  const [newestInbound, humanReplied] = await Promise.all([
    latestInboundMessageId(opts.clientId, opts.leadId),
    humanRepliedRecently(opts.clientId, opts.leadId),
  ]);
  if (humanReplied) {
    log("cancel.human_replied", { executionId: opts.executionId });
    await updateConversationAgentState(opts.clientId, opts.leadId, { status: "HUMAN_HANDLING" });
    return {
      executionState: "CANCELLED",
      final,
      reply: final.reply,
      replyStatus: "SUPPRESSED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
      errorCode: "HUMAN_REPLIED",
    };
  }
  if (newestInbound && newestInbound !== context.conversation.latestMessageId) {
    log("cancel.stale_context", { executionId: opts.executionId });
    return {
      executionState: "CANCELLED",
      final,
      reply: final.reply,
      replyStatus: "SUPPRESSED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
      errorCode: "STALE_CONTEXT",
      staleRerun: true,
    };
  }

  const sendResult = await sendCanonicalWhatsAppText({
    clientId: opts.clientId,
    leadId: opts.leadId,
    to: context.customer.phone ?? "",
    body: final.reply,
    actorId: null,
    actorName: "SegmiQ Agent",
    actorRole: "SYSTEM",
  });

  if (!sendResult.ok) {
    log("send_failed", { executionId: opts.executionId, error: sendResult.error });
    // CRM work already happened; the customer just hasn't received the reply.
    await createAgentEscalation({
      clientId: opts.clientId,
      leadId: opts.leadId,
      executionId: opts.executionId,
      reason: "SYSTEM_FAILURE",
      summary: `The agent handled the message but the WhatsApp reply could not be delivered (${sendResult.error ?? "connection unavailable"}). The customer has NOT been answered.`,
      ownerId: context.lead.ownerId,
      escalationUserId: settings.escalationUserId,
    });
    return {
      executionState: "COMPLETED",
      final,
      reply: final.reply,
      replyStatus: "FAILED",
      toolCalls: executedCalls,
      inputTokens,
      outputTokens,
      model,
      errorCode: "SEND_FAILED",
      errorMessage: sendResult.error,
    };
  }

  // Suppress noisy per-run persistence errors — the audit row is best-effort.
  await supabase
    .from("agent_executions")
    .update({ reply_status: "SENT" })
    .eq("id", opts.executionId);

  return {
    executionState: escalated ? "WAITING_FOR_HUMAN" : "COMPLETED",
    final,
    reply: final.reply,
    replyStatus: "SENT",
    toolCalls: executedCalls,
    inputTokens,
    outputTokens,
    model,
  };
}

async function executeToolBatch(
  toolCtx: ToolExecutionContext,
  toolCalls: ModelToolCall[],
  executedCalls: ExecutedToolCall[],
  opts: RunOptions & { executionId: string }
): Promise<Array<{ toolCallId: string; content: string; isError?: boolean }>> {
  const supabase = createAdminClient();
  const results: Array<{ toolCallId: string; content: string; isError?: boolean }> = [];

  for (const call of toolCalls) {
    if (executedCalls.length >= MAX_TOOL_CALLS) {
      results.push({
        toolCallId: call.id,
        content: "Tool budget exhausted for this run. Finish with your final JSON now.",
        isError: true,
      });
      continue;
    }

    log("tool.requested", {
      executionId: opts.executionId,
      tool: call.name,
    });
    const executed = await runAgentTool(toolCtx, call.name, call.input);
    executedCalls.push(executed);
    log("tool.finished", {
      executionId: opts.executionId,
      tool: call.name,
      status: executed.status,
    });

    // Audit record per action (input summary trimmed; no secrets).
    await supabase.from("agent_execution_actions").insert({
      execution_id: opts.executionId,
      client_id: opts.clientId,
      tool_name: executed.toolName,
      risk_level: executed.riskLevel,
      status: executed.status,
      input_summary: truncateJson(call.input),
      result_summary: truncateJson(executed.result.summary),
      blocked_reason: executed.blockedReason ?? null,
      error: executed.result.error?.slice(0, 400) ?? null,
      created_record_type: executed.result.createdRecordType ?? null,
      created_record_id: executed.result.createdRecordId ?? null,
    });

    results.push({
      toolCallId: call.id,
      content: JSON.stringify(executed.result.summary).slice(0, 4000),
      isError: !executed.result.ok,
    });
  }
  return results;
}

function truncateJson(value: unknown): Record<string, unknown> {
  try {
    const text = JSON.stringify(value ?? {});
    if (text.length <= 4000) return JSON.parse(text) as Record<string, unknown>;
    return { truncated: true, preview: text.slice(0, 3800) };
  } catch {
    return { unserializable: true };
  }
}

// ---------------------------------------------------------------------------
// Simulation (Agent Test Mode) — reasons with real context + read-only tools,
// simulates mutations, never sends customer messages.

export async function simulateAgentRun(opts: {
  clientId: string;
  leadId: string;
  customerMessage: string;
}): Promise<AgentRunResult> {
  const settings = await getAgentCompanySettings(opts.clientId);
  return runAgentExecution({
    clientId: opts.clientId,
    leadId: opts.leadId,
    triggerMessageId: null,
    settings,
    afterHoursAck: false,
    testMode: true,
    retryOnStaleContext: false,
    simulatedCustomerMessage: opts.customerMessage,
  });
}
