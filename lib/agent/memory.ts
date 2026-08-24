import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentCustomerMemory, AgentMemoryEntry } from "./types";

/**
 * Structured customer memory, keyed by contact.
 *
 * Entries are flat dot-path keys within known top-level groups, e.g.
 * "requirements.projectType", "commercial.budget", "timing.desiredInstallation",
 * "concerns.batteryRuntime", "preferences.preferredChannel".
 *
 * New values supersede old ones (history preserved in `superseded`), and
 * canonical CRM fields always win over inferred memory at context-assembly
 * time — see context.ts.
 */

export const MEMORY_GROUPS = [
  "preferences",
  "requirements",
  "commercial",
  "timing",
  "concerns",
  "commitments",
] as const;

const MAX_ENTRIES = 60;
const MAX_VALUE_LENGTH = 300;
const MAX_SUPERSEDED = 5;

export function isValidMemoryKey(key: string): boolean {
  const [group, field] = key.split(".");
  if (!group || !field) return false;
  if (!(MEMORY_GROUPS as readonly string[]).includes(group)) return false;
  return /^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(field);
}

export type MemoryUpdateInput = {
  key: string;
  value: string;
  confidence: number;
  evidence?: string;
  source?: AgentMemoryEntry["source"];
};

/**
 * Pure supersession merge — new values replace current ones and push the old
 * value into history. Contradictory values are never kept as equally current.
 */
export function applyMemoryUpdates(
  current: AgentCustomerMemory,
  updates: MemoryUpdateInput[],
  now = new Date().toISOString()
): { memory: AgentCustomerMemory; applied: string[]; rejected: string[] } {
  const memory: AgentCustomerMemory = { ...current };
  const applied: string[] = [];
  const rejected: string[] = [];

  for (const update of updates) {
    const key = update.key.trim();
    const value = update.value.trim().slice(0, MAX_VALUE_LENGTH);
    if (!isValidMemoryKey(key) || !value) {
      rejected.push(key || "(empty)");
      continue;
    }
    const confidence = Math.max(0, Math.min(1, update.confidence));
    const existing = memory[key];
    if (existing && existing.value === value) {
      memory[key] = { ...existing, confidence: Math.max(existing.confidence, confidence), updatedAt: now };
      applied.push(key);
      continue;
    }
    const superseded = existing
      ? [{ value: existing.value, updatedAt: existing.updatedAt }, ...(existing.superseded ?? [])].slice(
          0,
          MAX_SUPERSEDED
        )
      : undefined;
    memory[key] = {
      value,
      source: update.source ?? "customer_message",
      confidence,
      updatedAt: now,
      ...(update.evidence ? { evidence: update.evidence.slice(0, 200) } : {}),
      ...(superseded ? { superseded } : {}),
    };
    applied.push(key);
  }

  // Bound total size: drop oldest low-confidence entries beyond the cap.
  const keys = Object.keys(memory);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort(
      (a, b) => new Date(memory[a].updatedAt).getTime() - new Date(memory[b].updatedAt).getTime()
    );
    for (const key of sorted.slice(0, keys.length - MAX_ENTRIES)) delete memory[key];
  }

  return { memory, applied, rejected };
}

export async function loadCustomerMemory(
  clientId: string,
  contactId: string | null
): Promise<AgentCustomerMemory> {
  if (!contactId) return {};
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_customer_memory")
    .select("memory")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .maybeSingle();
  return ((data?.memory as AgentCustomerMemory | null) ?? {}) as AgentCustomerMemory;
}

export async function saveCustomerMemoryUpdates(opts: {
  clientId: string;
  contactId: string;
  updates: MemoryUpdateInput[];
}): Promise<{ applied: string[]; rejected: string[] }> {
  const supabase = createAdminClient();
  const current = await loadCustomerMemory(opts.clientId, opts.contactId);
  const { memory, applied, rejected } = applyMemoryUpdates(current, opts.updates);
  if (applied.length) {
    const { error } = await supabase.from("agent_customer_memory").upsert(
      {
        client_id: opts.clientId,
        contact_id: opts.contactId,
        memory,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,contact_id" }
    );
    if (error) throw new Error(`Failed to save customer memory: ${error.message}`);
  }
  return { applied, rejected };
}

/** Compact current-values view for prompts and briefings (no history). */
export function memoryForContext(memory: AgentCustomerMemory): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(memory)) {
    out[key] = entry.value;
  }
  return out;
}
