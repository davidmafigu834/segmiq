import { createAdminClient } from "@/lib/supabase/admin";

export async function logAiAction(input: {
  clientId: string;
  userId: string | null;
  toolName: string;
  riskLevel: "READ" | "PREPARE" | "WRITE_LOW" | "WRITE_HIGH";
  argumentsSummary: Record<string, unknown>;
  resultSummary: string;
  approvalRequired: boolean;
  status: "COMPLETED" | "PENDING" | "FAILED" | "CANCELLED";
}) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_action_log")
    .insert({
      client_id: input.clientId,
      user_id: input.userId,
      tool_name: input.toolName,
      risk_level: input.riskLevel,
      arguments_summary: input.argumentsSummary,
      result_summary: input.resultSummary.slice(0, 1000),
      approval_required: input.approvalRequired,
      status: input.status,
    })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

export async function logAiUsage(input: {
  clientId: string;
  userId: string | null;
  feature: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const supabase = createAdminClient();
  await supabase.from("ai_usage_events").insert({
    client_id: input.clientId,
    user_id: input.userId,
    feature: input.feature,
    model: input.model,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    estimated_cost: 0,
  });
}

export async function intelligenceFlags(clientId: string) {
  const supabase = createAdminClient();
  const [{ data: agent }, { data: portal }] = await Promise.all([
    supabase.from("agent_company_settings").select("operations_ai_enabled, agent_actions_enabled").eq("client_id", clientId).maybeSingle(),
    supabase.from("customer_portal_settings").select("portal_ai_enabled, enabled").eq("client_id", clientId).maybeSingle(),
  ]);
  return {
    operations: Boolean(agent?.operations_ai_enabled),
    actions: Boolean(agent?.agent_actions_enabled),
    portal: Boolean(portal?.enabled) && Boolean(portal?.portal_ai_enabled),
  };
}
