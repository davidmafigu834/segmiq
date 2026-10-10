import { createAdminClient } from "@/lib/supabase/admin";
import { runCopilotAnalysis } from "./runtime";

const DEBOUNCE_MS = 8_000;

export async function enqueueCopilotAnalysis(input: { clientId: string; leadId: string; reason: string }) {
  const supabase = createAdminClient();
  const runAfter = new Date(Date.now() + DEBOUNCE_MS).toISOString();
  const { error } = await supabase.from("sales_copilot_jobs").upsert(
    {
      lead_id: input.leadId,
      client_id: input.clientId,
      run_after: runAfter,
      status: "scheduled",
      reason: input.reason,
      generation: 1,
      coalesce_count: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lead_id" }
  );
  if (error) {
    if (/sales_copilot_jobs|does not exist|relation/i.test(error.message)) return;
    console.error("[sales-copilot] enqueue", error.message);
    return;
  }
  const { data: current } = await supabase
    .from("sales_copilot_jobs")
    .select("generation, status")
    .eq("lead_id", input.leadId)
    .maybeSingle();
  if (current && current.status !== "scheduled") {
    await supabase
      .from("sales_copilot_jobs")
      .update({
        run_after: runAfter,
        generation: Number(current.generation ?? 1) + 1,
        reason: input.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", input.leadId);
  } else if (current) {
    await supabase
      .from("sales_copilot_jobs")
      .update({
        run_after: runAfter,
        generation: Number(current.generation ?? 1) + 1,
        coalesce_count: Number(current.generation ?? 1) + 1,
        reason: input.reason,
        status: "scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("lead_id", input.leadId);
  }
  setTimeout(() => {
    void runDueCopilotJobs(3).catch(() => undefined);
  }, DEBOUNCE_MS + 250);
}

export async function runDueCopilotJobs(limit = 5) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sales_copilot_jobs")
    .select("lead_id, client_id, generation")
    .eq("status", "scheduled")
    .lte("run_after", now)
    .limit(limit);
  if (error) {
    if (/sales_copilot_jobs|does not exist|relation/i.test(error.message)) return;
    throw new Error(error.message);
  }
  for (const job of data ?? []) {
    const generation = Number(job.generation ?? 1);
    const claimed = await supabase
      .from("sales_copilot_jobs")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("lead_id", job.lead_id)
      .eq("status", "scheduled")
      .eq("generation", generation)
      .select("lead_id")
      .maybeSingle();
    if (claimed.error || !claimed.data) continue;
    try {
      await runCopilotAnalysis(String(job.client_id), String(job.lead_id));
      const { data: after } = await supabase
        .from("sales_copilot_jobs")
        .select("generation")
        .eq("lead_id", job.lead_id)
        .maybeSingle();
      const moved = Number(after?.generation ?? generation) !== generation;
      await supabase
        .from("sales_copilot_jobs")
        .update({
          status: moved ? "scheduled" : "done",
          updated_at: new Date().toISOString(),
        })
        .eq("lead_id", job.lead_id)
        .eq("status", "running");
    } catch (err) {
      await supabase
        .from("sales_copilot_jobs")
        .update({
          status: "failed",
          reason: err instanceof Error ? err.message.slice(0, 240) : "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("lead_id", job.lead_id);
      await saveFailedAnalysis(String(job.client_id), String(job.lead_id), err);
    }
  }
}

async function saveFailedAnalysis(clientId: string, leadId: string, err: unknown) {
  const { saveAnalysis } = await import("./store");
  await saveAnalysis({
    leadId,
    clientId,
    status: "failed",
    contextRevision: "failed",
    summary: "Sales Copilot could not read the latest messages. Chat and manual tasks still work.",
    facts: {},
    lastMessageId: null,
    lastMessageAt: null,
    error: err instanceof Error ? err.message.slice(0, 240) : "failed",
    model: null,
  }).catch(() => undefined);
}
