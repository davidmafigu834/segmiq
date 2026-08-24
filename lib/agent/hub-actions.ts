import { createAdminClient } from "@/lib/supabase/admin";
import { sendCanonicalWhatsAppText } from "@/lib/whatsapp/message-service";
import { createAgentEscalation } from "./escalation";
import { getAgentCompanySettings } from "./settings";
import { runAgentTool } from "./tools/execute";
import { TOOL_DISPLAY_NAMES, TOOL_METADATA, type AgentToolName, isRegisteredTool } from "./tools/registry";
import type { ToolExecutionContext } from "./tools/context";
import { asRow, asRows } from "./rows";

const SUGGESTABLE_TOOLS = new Set<AgentToolName>([
  "deal_create",
  "task_create_follow_up",
  "calendar_schedule_callback",
  "calendar_reschedule_callback",
  "quotation_prepare_draft",
  "quotation_send",
  "conversation_transfer_support",
  "lead_update_qualification",
]);

export type SuggestedAgentAction = {
  id: string;
  toolName: string;
  label: string;
  inputSummary: Record<string, unknown> | null;
};

async function latestDraftedExecution(leadId: string, clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_executions")
    .select("id, customer_reply, reply_status")
    .eq("lead_id", leadId)
    .eq("client_id", clientId)
    .eq("reply_status", "DRAFTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return asRow<{ id: string; customer_reply: string | null; reply_status: string | null }>(data);
}

export async function sendAgentDraft(opts: {
  clientId: string;
  leadId: string;
  reply?: string;
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const execution = await latestDraftedExecution(opts.leadId, opts.clientId);
  const reply = (opts.reply ?? execution?.customer_reply ?? "").trim();
  if (!reply) return { ok: false, error: "No drafted reply to send" };

  const sendResult = await sendCanonicalWhatsAppText({
    clientId: opts.clientId,
    leadId: opts.leadId,
    to: "",
    body: reply,
    actorId: null,
    actorName: "SegmiQ Agent",
    actorRole: "SYSTEM",
  });
  if (!sendResult.ok) return { ok: false, error: sendResult.error ?? "Send failed" };

  if (execution?.id) {
    await createAdminClient()
      .from("agent_executions")
      .update({ reply_status: "SENT", customer_reply: reply })
      .eq("id", execution.id)
      .eq("client_id", opts.clientId);
  }
  return { ok: true, reply };
}

export async function rejectAgentDraft(opts: {
  clientId: string;
  leadId: string;
}): Promise<void> {
  const execution = await latestDraftedExecution(opts.leadId, opts.clientId);
  if (!execution?.id) return;
  await createAdminClient()
    .from("agent_executions")
    .update({ reply_status: "SUPPRESSED" })
    .eq("id", execution.id)
    .eq("client_id", opts.clientId);
}

async function buildToolContext(opts: {
  clientId: string;
  leadId: string;
}): Promise<ToolExecutionContext | { error: string }> {
  const supabase = createAdminClient();
  const settings = await getAgentCompanySettings(opts.clientId);
  const { data: lead } = await supabase
    .from("leads")
    .select("id, assigned_to_id, contact_id")
    .eq("id", opts.leadId)
    .eq("client_id", opts.clientId)
    .maybeSingle();
  if (!lead) return { error: "Lead not found" };

  let ownerName: string | null = null;
  if (lead.assigned_to_id) {
    const { data: owner } = await supabase
      .from("users")
      .select("name")
      .eq("id", lead.assigned_to_id)
      .maybeSingle();
    ownerName = (owner?.name as string | null) ?? null;
  }

  const { resolveClientSalesTimezone } = await import(
    "@/lib/sales/intelligence/daily-plan-service"
  );
  const timezone = await resolveClientSalesTimezone(opts.clientId);

  return {
    clientId: opts.clientId,
    leadId: opts.leadId,
    contactId: (lead.contact_id as string | null) ?? null,
    ownerId: (lead.assigned_to_id as string | null) ?? null,
    ownerName,
    executionId: `human-approved-${opts.leadId}`,
    timezone,
    settings,
    testMode: false,
  };
}

export async function applySuggestedAgentActions(opts: {
  clientId: string;
  leadId: string;
}): Promise<{ applied: string[]; failed: string[] }> {
  const supabase = createAdminClient();
  const { data: executionData } = await supabase
    .from("agent_executions")
    .select("id")
    .eq("lead_id", opts.leadId)
    .eq("client_id", opts.clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const execution = asRow<{ id: string }>(executionData);
  if (!execution?.id) return { applied: [], failed: [] };

  const { data: actionsData } = await supabase
    .from("agent_execution_actions")
    .select("id, tool_name, input_summary, status")
    .eq("execution_id", execution.id)
    .eq("status", "BLOCKED");
  const actions = asRows<{
    id: string;
    tool_name: string;
    input_summary: Record<string, unknown> | null;
    status: string;
  }>(actionsData);

  const ctx = await buildToolContext(opts);
  if ("error" in ctx) return { applied: [], failed: [ctx.error] };

  const applied: string[] = [];
  const failed: string[] = [];
  for (const action of actions) {
    const toolName = action.tool_name;
    if (!isRegisteredTool(toolName) || !SUGGESTABLE_TOOLS.has(toolName)) continue;
    const executed = await runAgentTool(ctx, toolName, action.input_summary ?? {}, {
      humanApproved: true,
    });
    await supabase.from("agent_execution_actions").insert({
      execution_id: execution.id,
      client_id: opts.clientId,
      tool_name: executed.toolName,
      risk_level: executed.riskLevel,
      status: executed.status,
      input_summary: action.input_summary,
      result_summary: executed.result.summary,
      blocked_reason: executed.blockedReason ?? null,
      error: executed.result.error ?? null,
      created_record_type: executed.result.createdRecordType ?? null,
      created_record_id: executed.result.createdRecordId ?? null,
    });
    const label = TOOL_DISPLAY_NAMES[toolName] ?? toolName;
    if (executed.status === "EXECUTED") applied.push(label);
    else failed.push(label);
  }
  return { applied, failed };
}

export async function escalateConversationFromHub(opts: {
  clientId: string;
  leadId: string;
  ownerId: string | null;
  summary?: string;
}): Promise<void> {
  const settings = await getAgentCompanySettings(opts.clientId);
  await createAgentEscalation({
    clientId: opts.clientId,
    leadId: opts.leadId,
    executionId: null,
    reason: "UNSUPPORTED_REQUEST",
    summary: opts.summary?.trim() || "A teammate asked SegmiQ Agent to hand this conversation to a human.",
    ownerId: opts.ownerId,
    escalationUserId: settings.escalationUserId,
  });
}

export function suggestedActionsFromRows(
  rows: Array<{
    id: string;
    tool_name: string;
    status: string;
    input_summary: Record<string, unknown> | null;
  }>
): SuggestedAgentAction[] {
  return rows
    .filter((row) => {
      if (row.status !== "BLOCKED") return false;
      if (!isRegisteredTool(row.tool_name)) return false;
      if (!SUGGESTABLE_TOOLS.has(row.tool_name)) return false;
      return !TOOL_METADATA[row.tool_name].readOnly;
    })
    .map((row) => ({
      id: row.id,
      toolName: row.tool_name,
      label: TOOL_DISPLAY_NAMES[row.tool_name as AgentToolName] ?? row.tool_name.replace(/_/g, " "),
      inputSummary: row.input_summary,
    }));
}
