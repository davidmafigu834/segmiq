import { createAdminClient } from "@/lib/supabase/admin";

export async function recordLearningAudit(opts: {
  clientId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("agent_learning_audit").insert({
      client_id: opts.clientId,
      actor_id: opts.actorId ?? null,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      summary: opts.summary.slice(0, 500),
      payload: opts.payload ?? null,
    });
  } catch (err) {
    console.error("[learning] audit write failed", err);
  }
}
