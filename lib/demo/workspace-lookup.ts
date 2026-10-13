import { getGuestContext } from "@/lib/demo/context";
import { DemoAccessDenied } from "@/lib/demo/errors";
import type { WorkspaceMode } from "@/lib/demo/mode";

/** Columns a guest is allowed to see for their own workspace. No integration secrets. */
export const PINNED_WORKSPACE_COLUMNS =
  "id, name, workspace_mode, demo_industry, demo_scenario, business_type, sales_workflow_preset, logo_url";

export type PinnedDemoWorkspace = {
  id: string;
  name: string | null;
  mode: WorkspaceMode;
  industry: string | null;
  scenario: string | null;
  businessType: string | null;
  salesWorkflowPreset: string | null;
  logoUrl: string | null;
};

/**
 * The only organisation id a guest lookup may use.
 * A missing or different id is a denial, not a wider query.
 */
export function requirePinnedWorkspaceId(guestClientId: string, requested: string | null | undefined): string {
  if (!requested || requested !== guestClientId) throw new DemoAccessDenied();
  return guestClientId;
}

type WorkspaceRow = {
  id: string;
  name?: string | null;
  workspace_mode?: string | null;
  demo_industry?: string | null;
  demo_scenario?: string | null;
  business_type?: string | null;
  sales_workflow_preset?: string | null;
  logo_url?: string | null;
};

function projectWorkspace(row: WorkspaceRow): PinnedDemoWorkspace {
  return {
    id: row.id,
    name: row.name ?? null,
    mode: row.workspace_mode === "demo" ? "demo" : "production",
    industry: row.demo_industry ?? null,
    scenario: row.demo_scenario ?? null,
    businessType: row.business_type ?? null,
    salesWorkflowPreset: row.sales_workflow_preset ?? null,
    logoUrl: row.logo_url ?? null,
  };
}

/**
 * One organisation, by primary key, with a fixed column list.
 * When a guest context is active, the id must be that session's workspace.
 * This is not a list query and it cannot update the row.
 */
export async function readPinnedDemoWorkspace(workspaceId: string): Promise<PinnedDemoWorkspace | null> {
  const guest = getGuestContext();
  const id = guest ? requirePinnedWorkspaceId(guest.clientId, workspaceId) : workspaceId;
  if (!id) return null;
  const { createUnguardedAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createUnguardedAdminClient();
  const { data, error } = await supabase
    .from("clients")
    .select(PINNED_WORKSPACE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as WorkspaceRow;
  if (row.id !== id) throw new DemoAccessDenied();
  return projectWorkspace(row);
}
