import type { DemoMutation } from "@/lib/demo/types";

const memory = new Map<string, DemoMutation[]>();

/**
 * Demo mutations are disposable. They are kept in memory and, when the
 * `demo_workspace_mutations` table exists, mirrored there so a reset survives
 * a process restart. Canonical records are never written to CRM tables.
 */
export async function readDemoMutations(clientId: string): Promise<DemoMutation[]> {
  const cached = memory.get(clientId);
  if (cached) return cached;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("demo_workspace_mutations")
      .select("mutations")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error || !data) {
      memory.set(clientId, []);
      return [];
    }
    const mutations = Array.isArray((data as { mutations?: unknown }).mutations)
      ? ((data as { mutations: DemoMutation[] }).mutations)
      : [];
    memory.set(clientId, mutations);
    return mutations;
  } catch {
    memory.set(clientId, []);
    return [];
  }
}

export async function writeDemoMutations(clientId: string, mutations: DemoMutation[]): Promise<void> {
  memory.set(clientId, mutations);
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("demo_workspace_mutations").upsert({
      client_id: clientId,
      mutations,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Memory copy remains the source of truth for this process.
  }
}

export async function resetDemoMutations(clientId: string): Promise<void> {
  memory.set(clientId, []);
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("demo_workspace_mutations").delete().eq("client_id", clientId);
  } catch {
    // In-memory reset already applied.
  }
}

export function clearDemoMemory(clientId?: string): void {
  if (clientId) memory.delete(clientId);
  else memory.clear();
}
