/**
 * Workspace mode is an organisation property (`clients.workspace_mode`).
 * Callers must not branch on demo email addresses.
 */

export type WorkspaceMode = "production" | "demo";

export type WorkspaceConfig = {
  clientId: string;
  mode: WorkspaceMode;
  industry: string | null;
  scenario: string | null;
  name: string | null;
  timezone: string | null;
};

export function isDemoWorkspace(workspace: { workspace_mode?: string | null; mode?: string | null } | null | undefined): boolean {
  if (!workspace) return false;
  return workspace.workspace_mode === "demo" || workspace.mode === "demo";
}

const cache = new Map<string, { config: WorkspaceConfig; at: number }>();
const CACHE_MS = 30_000;

export function clearWorkspaceModeCache(): void {
  cache.clear();
}

function asMode(value: unknown): WorkspaceMode {
  return value === "demo" ? "demo" : "production";
}

/**
 * Reads workspace mode for one organisation.
 * Missing column or a failed lookup fails closed to production so a
 * migration lag cannot flip a real customer into demo mode.
 */
export async function getWorkspaceConfig(clientId: string | null | undefined): Promise<WorkspaceConfig | null> {
  if (!clientId) return null;
  const hit = cache.get(clientId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.config;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, workspace_mode, demo_industry, demo_scenario")
      .eq("id", clientId)
      .maybeSingle();

    if (error || !data) {
      const message = String(error?.message ?? "");
      if (message.includes("workspace_mode") || message.includes("demo_industry")) {
        const fallback: WorkspaceConfig = {
          clientId,
          mode: "production",
          industry: null,
          scenario: null,
          name: null,
          timezone: null,
        };
        cache.set(clientId, { config: fallback, at: Date.now() });
        return fallback;
      }
      return null;
    }

    const row = data as {
      id: string;
      name?: string | null;
      workspace_mode?: string | null;
      demo_industry?: string | null;
      demo_scenario?: string | null;
    };
    const config: WorkspaceConfig = {
      clientId: row.id,
      mode: asMode(row.workspace_mode),
      industry: row.demo_industry ?? null,
      scenario: row.demo_scenario ?? null,
      name: row.name ?? null,
      timezone: "Africa/Harare",
    };
    cache.set(clientId, { config, at: Date.now() });
    return config;
  } catch {
    return null;
  }
}

export async function isDemoWorkspaceId(clientId: string | null | undefined): Promise<boolean> {
  const config = await getWorkspaceConfig(clientId);
  return config?.mode === "demo";
}
