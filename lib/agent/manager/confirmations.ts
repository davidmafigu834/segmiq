import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRow } from "@/lib/agent/rows";
import { now } from "@/lib/clock";
import { CONFIRMATION_TTL_MS, type ConfirmationPreview, type ManagerActor } from "./types";

export type StoredConfirmation = {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  entityVersions: Record<string, string>;
  preview: ConfirmationPreview;
  status: string;
  expiresAt: string;
};

function fingerprint(actor: ManagerActor, toolName: string, args: Record<string, unknown>): string {
  const body = JSON.stringify({ u: actor.userId, t: toolName, a: args });
  return createHash("sha256").update(body).digest("hex").slice(0, 40);
}

export async function createConfirmation(opts: {
  actor: ManagerActor;
  sessionId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  entityVersions: Record<string, string>;
  preview: ConfirmationPreview;
}): Promise<StoredConfirmation> {
  const supabase = createAdminClient();
  const key = fingerprint(opts.actor, opts.toolName, opts.args);
  const expires = new Date(now().getTime() + CONFIRMATION_TTL_MS).toISOString();
  await supabase
    .from("agent_manager_confirmations")
    .update({ status: "EXPIRED" })
    .eq("client_id", opts.actor.clientId)
    .eq("idempotency_key", key)
    .eq("status", "PENDING");
  const { data, error } = await supabase
    .from("agent_manager_confirmations")
    .insert({
      client_id: opts.actor.clientId,
      user_id: opts.actor.userId,
      session_id: opts.sessionId,
      tool_name: opts.toolName,
      args: opts.args,
      entity_versions: opts.entityVersions,
      preview: opts.preview,
      status: "PENDING",
      idempotency_key: `${key}:${Date.now()}`,
      expires_at: expires,
    })
    .select("id, tool_name, args, entity_versions, preview, status, expires_at")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not create confirmation");
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    toolName: row.tool_name as string,
    args: (row.args as Record<string, unknown>) ?? {},
    entityVersions: (row.entity_versions as Record<string, string>) ?? {},
    preview: row.preview as ConfirmationPreview,
    status: row.status as string,
    expiresAt: row.expires_at as string,
  };
}

export async function getConfirmation(
  actor: ManagerActor,
  id: string
): Promise<StoredConfirmation | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_manager_confirmations")
    .select("*")
    .eq("id", id)
    .eq("client_id", actor.clientId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  const row = asRow<Record<string, unknown>>(data);
  if (!row) return null;
  return {
    id: row.id as string,
    toolName: row.tool_name as string,
    args: (row.args as Record<string, unknown>) ?? {},
    entityVersions: (row.entity_versions as Record<string, string>) ?? {},
    preview: row.preview as ConfirmationPreview,
    status: row.status as string,
    expiresAt: row.expires_at as string,
  };
}

export async function markConfirmation(
  id: string,
  status: "CONFIRMED" | "CANCELLED" | "STALE" | "EXPIRED",
  result?: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("agent_manager_confirmations")
    .update({
      status,
      confirmed_at: status === "CONFIRMED" ? now().toISOString() : null,
      result: result ?? null,
    })
    .eq("id", id)
    .eq("status", "PENDING");
}

export async function versionsStillMatch(
  entityVersions: Record<string, string>
): Promise<boolean> {
  const supabase = createAdminClient();
  for (const [key, version] of Object.entries(entityVersions)) {
    const [table, id] = key.split(":");
    if (!table || !id) continue;
    const { data } = await supabase.from(table).select("updated_at").eq("id", id).maybeSingle();
    const updated = (data as { updated_at?: string } | null)?.updated_at;
    if (updated && updated !== version) return false;
  }
  return true;
}
