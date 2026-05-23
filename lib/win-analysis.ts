import { createAdminClient } from "@/lib/supabase/admin";

export async function recordWinAnalysis(leadId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, client_id, assigned_to_id, deal_value, source, form_data, created_at")
    .eq("id", leadId)
    .single();

  if (!lead) return;

  const daysToClose = Math.round(
    (Date.now() - new Date(lead.created_at as string).getTime()) / (1000 * 60 * 60 * 24)
  );

  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("outcome")
    .eq("lead_id", leadId);

  const totalCalls = callLogs?.length ?? 0;
  const callsAnswered = callLogs?.filter((c) => c.outcome === "ANSWERED").length ?? 0;

  const { data: events } = await supabase
    .from("lead_events")
    .select("event_type, event_data")
    .eq("lead_id", leadId)
    .eq("event_type", "DOCUMENT_SENT");

  const sentEvents = events ?? [];

  const portfolioSent = sentEvents.some(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "PORTFOLIO"
  );
  const projectsSent = sentEvents.filter(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "PROJECT"
  ).length;
  const pricingSent = sentEvents.some(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "PRICING_PACKAGE"
  );
  const documentsSent = sentEvents.filter(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "DOCUMENT"
  ).length;
  const customMessagesSent = sentEvents.filter(
    (e) => (e.event_data as Record<string, unknown>)?.document_type === "CUSTOM_MESSAGE"
  ).length;

  const formData = (lead.form_data as Record<string, unknown> | null) ?? {};
  const projectType =
    (formData.project_type as string | null) ??
    (formData.service_type as string | null) ??
    (formData.service as string | null) ??
    null;
  const budgetRange =
    (formData.budget as string | null) ?? (formData.budget_range as string | null) ?? null;

  // Fetch assigned user separately to avoid FK name assumptions
  let salespersonName: string | null = null;
  if (lead.assigned_to_id) {
    const { data: assignedUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", lead.assigned_to_id as string)
      .maybeSingle();
    salespersonName = (assignedUser?.name as string | null) ?? null;
  }

  const { data: existing } = await supabase
    .from("win_analysis")
    .select("id")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("win_analysis")
      .update({
        days_to_close: daysToClose,
        total_calls: totalCalls,
        calls_answered: callsAnswered,
        portfolio_sent: portfolioSent,
        projects_sent: projectsSent,
        pricing_sent: pricingSent,
        documents_sent: documentsSent,
        custom_messages_sent: customMessagesSent,
        deal_value: lead.deal_value ?? null,
      })
      .eq("lead_id", leadId);
  } else {
    await supabase.from("win_analysis").insert({
      lead_id: leadId,
      client_id: lead.client_id as string,
      salesperson_id: (lead.assigned_to_id as string | null) ?? null,
      salesperson_name: salespersonName,
      days_to_close: daysToClose,
      total_calls: totalCalls,
      calls_answered: callsAnswered,
      portfolio_sent: portfolioSent,
      projects_sent: projectsSent,
      pricing_sent: pricingSent,
      documents_sent: documentsSent,
      custom_messages_sent: customMessagesSent,
      deal_value: (lead.deal_value as number | null) ?? null,
      source: (lead.source as string | null) ?? null,
      project_type: projectType,
      budget_range: budgetRange ? String(budgetRange) : null,
    });
  }
}
