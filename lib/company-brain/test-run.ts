import { assembleAgentContext, type AgentContext } from "@/lib/agent/context";
import { evaluateToolPolicy } from "@/lib/agent/policy";
import {
  AGENT_PROMPT_VERSION,
  buildContextMessage,
  buildSystemPrompt,
  parseAgentFinalOutput,
} from "@/lib/agent/prompt";
import { getAgentModelProvider, type AgentChatMessage } from "@/lib/agent/provider";
import { getAgentCompanySettings, isAgentGloballyEnabled } from "@/lib/agent/settings";
import { runAgentTool } from "@/lib/agent/tools/execute";
import { ASSIST_SAFE_TOOLS, TOOL_METADATA, buildToolDefinitions, type AgentToolName } from "@/lib/agent/tools/registry";
import type { ToolExecutionContext } from "@/lib/agent/tools/context";
import { assembleCompanyBrainContext } from "./context-service";
import { serializeCompanyBrainContext } from "./serialize";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export type BrainTestResult = {
  reply: string | null;
  intents: string[];
  confidence: number | null;
  decisionSummary: string | null;
  evidence: string | null;
  sources: Array<{ type: string; key: string; label: string; authority: number }>;
  why: string[];
  actions: Array<{
    toolName: string;
    status: string;
    riskLevel: string;
    summary: Record<string, unknown>;
    blockedReason?: string;
  }>;
  detectedTopics: string[];
  promptVersion: string;
  error?: string;
};

function syntheticContext(opts: {
  clientId: string;
  settings: Awaited<ReturnType<typeof getAgentCompanySettings>>;
  message: string;
  assembled: Awaited<ReturnType<typeof assembleCompanyBrainContext>>;
}): AgentContext {
  const { snapshot, context } = opts.assembled;
  const c = snapshot.canonical;
  return {
    company: {
      name: c.companyName,
      industry: c.industry,
      timezone: c.timezone,
      workingDays: c.workingDays,
      workStartTime: c.workStartTime,
      workEndTime: c.workEndTime,
    },
    customer: {
      name: "Test customer",
      phone: null,
      isNewLead: true,
      lifecycle: null,
    },
    conversation: {
      leadId: NIL_UUID,
      type: "SALES",
      workflowStatus: "OPEN",
      messageCount: 1,
      recentMessages: [
        {
          direction: "inbound",
          senderSource: "CUSTOMER",
          body: opts.message.slice(0, 400),
          at: new Date().toISOString(),
        },
      ],
      olderMessagesNote: null,
      latestMessageId: null,
    },
    lead: {
      id: NIL_UUID,
      status: "NEW",
      source: "WHATSAPP_INBOUND",
      ownerId: null,
      ownerName: null,
      followUpDate: null,
    },
    qualification: { fields: [], missing: [] },
    deal: null,
    quotation: null,
    upcomingAppointment: null,
    memory: {},
    rawMemory: {},
    contactId: null,
    settings: opts.settings,
    companyBrain: {
      serialized: serializeCompanyBrainContext(opts.assembled),
      sources: context.sources,
      retrievalFailed: context.retrievalFailed,
      playbook: context.playbook,
      operationalKeys: snapshot.rules.filter((r) => r.enabled && r.structuredKey).map((r) => r.structuredKey as string),
      why: context.why,
      context,
    },
  };
}

/**
 * Test Agent: full reasoning against Company Brain with a hypothetical
 * customer message. Never sends WhatsApp and never writes CRM records.
 */
export async function runCompanyBrainTest(opts: {
  clientId: string;
  message: string;
  leadId?: string | null;
}): Promise<BrainTestResult> {
  if (!isAgentGloballyEnabled()) {
    return {
      reply: null,
      intents: [],
      confidence: null,
      decisionSummary: null,
      evidence: null,
      sources: [],
      why: [],
      actions: [],
      detectedTopics: [],
      promptVersion: AGENT_PROMPT_VERSION,
      error: "SegmiQ Agent is not configured on this server.",
    };
  }

  const settings = await getAgentCompanySettings(opts.clientId);
  const assembled = await assembleCompanyBrainContext({
    clientId: opts.clientId,
    customerMessage: opts.message,
  });

  let context: AgentContext;
  if (opts.leadId) {
    const live = await assembleAgentContext({
      clientId: opts.clientId,
      leadId: opts.leadId,
      settings,
      overlayCustomerMessage: opts.message,
    });
    context = live ?? syntheticContext({ clientId: opts.clientId, settings, message: opts.message, assembled });
  } else {
    context = syntheticContext({ clientId: opts.clientId, settings, message: opts.message, assembled });
  }

  const provider = getAgentModelProvider();
  const toolCtx: ToolExecutionContext = {
    clientId: opts.clientId,
    leadId: context.lead.id,
    contactId: context.contactId,
    ownerId: context.lead.ownerId,
    ownerName: context.lead.ownerName,
    executionId: NIL_UUID,
    timezone: context.company.timezone,
    settings,
    testMode: true,
    standalone: true,
    operationalRuleKeys: context.companyBrain?.operationalKeys ?? [],
    workingDays: context.company.workingDays,
    workStartTime: context.company.workStartTime,
    workEndTime: context.company.workEndTime,
    playbookFieldKeys: context.companyBrain?.playbook?.fields.map((f) => f.internalKey) ?? [],
    playbookRequiredKeys:
      context.companyBrain?.playbook?.fields.filter((f) => f.required).map((f) => f.internalKey) ?? [],
  };

  const availableTools = (Object.keys(TOOL_METADATA) as AgentToolName[]).filter((name) => {
    if (settings.autonomyMode === "ASSIST") return ASSIST_SAFE_TOOLS.has(name);
    return evaluateToolPolicy(TOOL_METADATA[name], settings).allowed;
  });

  const system = buildSystemPrompt({ settings, companyName: context.company.name });
  let contextMessage = buildContextMessage({ context, afterHoursAck: false });
  contextMessage += `\n\n[CUSTOMER] ${opts.message}\n\n=== TEST MODE ===\nThis is a manager simulation. Propose tools as usual; mutating actions will be simulated and nothing will be sent to a customer.`;

  const messages: AgentChatMessage[] = [{ role: "user", text: contextMessage }];
  const actions: BrainTestResult["actions"] = [];
  let finalText: string | null = null;

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await provider.generate({
        system,
        messages,
        tools: buildToolDefinitions(availableTools),
        maxTokens: 1400,
      });
      if (response.stopReason !== "tool_use" || !response.toolCalls.length) {
        finalText = response.text;
        break;
      }
      messages.push({
        role: "assistant",
        text: response.text,
        toolCalls: response.toolCalls,
        echo: response.echo,
      });
      const results = [];
      for (const call of response.toolCalls) {
        const executed = await runAgentTool(toolCtx, call.name, call.input);
        actions.push({
          toolName: executed.toolName,
          status: executed.status === "EXECUTED" ? "SIMULATED" : executed.status,
          riskLevel: executed.riskLevel,
          summary: executed.result.summary,
          blockedReason: executed.blockedReason,
        });
        results.push({
          toolCallId: call.id,
          content: JSON.stringify(executed.result.summary).slice(0, 1500),
          isError: !executed.result.ok,
        });
      }
      messages.push({ role: "toolResult", results });
    }

    let final = parseAgentFinalOutput(finalText);
    if (!final) {
      const repair = await provider.generate({
        system,
        messages: [
          ...messages,
          {
            role: "user",
            text: "Your last message was not the required JSON object. Respond now with ONLY the final JSON object.",
          },
        ],
        tools: buildToolDefinitions(availableTools),
        maxTokens: 800,
      });
      final = parseAgentFinalOutput(repair.text);
    }

    return {
      reply: final?.reply ?? null,
      intents: final?.intents ?? [],
      confidence: final?.confidence ?? null,
      decisionSummary: final?.decisionSummary ?? null,
      evidence: final?.evidence ?? null,
      sources: context.companyBrain?.sources ?? [],
      why: context.companyBrain?.why ?? [],
      actions,
      detectedTopics: context.companyBrain?.context.why ?? [],
      promptVersion: AGENT_PROMPT_VERSION,
      error: final ? undefined : "The model did not return a valid test response.",
    };
  } catch (err) {
    return {
      reply: null,
      intents: [],
      confidence: null,
      decisionSummary: null,
      evidence: null,
      sources: context.companyBrain?.sources ?? [],
      why: context.companyBrain?.why ?? [],
      actions,
      detectedTopics: [],
      promptVersion: AGENT_PROMPT_VERSION,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
