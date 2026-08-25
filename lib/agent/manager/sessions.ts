import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import type { ManagerActor, ManagerBlock } from "./types";

export async function createOrGetSession(opts: {
  actor: ManagerActor;
  sessionId?: string | null;
  pageContext?: Record<string, unknown>;
}): Promise<{ id: string; resultSet: ResultSet | null; pendingConfirmationId: string | null }> {
  const supabase = createAdminClient();
  if (opts.sessionId) {
    const { data } = await supabase
      .from("agent_manager_sessions")
      .select("id, result_set, pending_confirmation_id")
      .eq("id", opts.sessionId)
      .eq("client_id", opts.actor.clientId)
      .eq("user_id", opts.actor.userId)
      .maybeSingle();
    const row = asRow<{ id: string; result_set: ResultSet | null; pending_confirmation_id: string | null }>(data);
    if (row) {
      return {
        id: row.id,
        resultSet: row.result_set,
        pendingConfirmationId: row.pending_confirmation_id,
      };
    }
  }
  const { data, error } = await supabase
    .from("agent_manager_sessions")
    .insert({
      client_id: opts.actor.clientId,
      user_id: opts.actor.userId,
      page_context: opts.pageContext ?? {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not open Command Center session");
  return { id: (data as { id: string }).id, resultSet: null, pendingConfirmationId: null };
}

export type ResultSet = {
  entityType: string;
  entityIds: string[];
  querySummary: string;
  createdAt: string;
};

export async function saveSessionState(opts: {
  sessionId: string;
  resultSet?: ResultSet | null;
  pendingConfirmationId?: string | null;
  title?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.resultSet !== undefined) patch.result_set = opts.resultSet;
  if (opts.pendingConfirmationId !== undefined) patch.pending_confirmation_id = opts.pendingConfirmationId;
  if (opts.title) patch.title = opts.title;
  await supabase.from("agent_manager_sessions").update(patch).eq("id", opts.sessionId);
}

export async function appendMessage(opts: {
  sessionId: string;
  clientId: string;
  role: "user" | "assistant";
  content: string;
  blocks?: ManagerBlock[];
  executionId?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("agent_manager_messages").insert({
    session_id: opts.sessionId,
    client_id: opts.clientId,
    role: opts.role,
    content: opts.content,
    blocks: opts.blocks ?? [],
    execution_id: opts.executionId ?? null,
  });
}

export async function listSessionMessages(opts: {
  actor: ManagerActor;
  sessionId: string;
  limit?: number;
}): Promise<Array<{ role: "user" | "assistant"; content: string; blocks: ManagerBlock[]; createdAt: string }>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_manager_messages")
    .select("role, content, blocks, created_at")
    .eq("session_id", opts.sessionId)
    .eq("client_id", opts.actor.clientId)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 40);
  return asRows<{
    role: "user" | "assistant";
    content: string;
    blocks: ManagerBlock[];
    created_at: string;
  }>(data).map((m) => ({
    role: m.role,
    content: m.content,
    blocks: m.blocks ?? [],
    createdAt: m.created_at,
  }));
}
