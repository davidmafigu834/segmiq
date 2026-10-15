import { createAdminClient } from "@/lib/supabase/admin";
import { guestAccessBlockReason, type GuestAccessBlockReason } from "@/lib/demo/deployment";
import { findDemoTemplate } from "@/lib/demo/template-catalog";

export type DemoWorkspaceOption = {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  scenario: string | null;
  templateReady: boolean;
};

export type DemoInvitationStatus = "active" | "expired" | "revoked";

export type DemoInvitationRecord = {
  id: string;
  clientId: string;
  workspaceName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdByName: string | null;
  openSessions: number;
  status: DemoInvitationStatus;
};

export type DemoAdminDirectory = {
  accessOpen: boolean;
  accessMessage: string | null;
  workspaces: DemoWorkspaceOption[];
  invitations: DemoInvitationRecord[];
  error: string | null;
};

export function invitationStatus(row: {
  revokedAt: string | null;
  expiresAt: string;
}, now = Date.now()): DemoInvitationStatus {
  if (row.revokedAt) return "revoked";
  if (Date.parse(row.expiresAt) <= now) return "expired";
  return "active";
}

export function guestAccessMessage(reason: GuestAccessBlockReason | null): string | null {
  if (!reason) return null;
  if (reason === "guest-access-disabled") {
    return "Guest links are switched off on this deployment. Turn guest access on, then redeploy, before creating a link.";
  }
  if (reason === "guest-schema-not-ready") {
    return "This deployment is not pinned to the applied guest-session schema. Correct that setting, then redeploy.";
  }
  if (reason === "shared-database-not-selected") {
    return "This deployment is not marked as the shared demo database. Correct that setting, then redeploy. Do not switch the whole application into isolated demo mode.";
  }
  return "Guest links are not available on this deployment.";
}

export async function loadDemoAdminDirectory(now = Date.now()): Promise<DemoAdminDirectory> {
  const accessMessage = guestAccessMessage(guestAccessBlockReason());
  const supabase = createAdminClient();
  const workspacesResult = await supabase
    .from("clients")
    .select("id, name, slug, demo_industry, demo_scenario")
    .eq("workspace_mode", "demo")
    .order("name");
  if (workspacesResult.error) {
    return {
      accessOpen: accessMessage == null,
      accessMessage,
      workspaces: [],
      invitations: [],
      error: "Demonstration workspaces could not be loaded.",
    };
  }

  const workspaces: DemoWorkspaceOption[] = (workspacesResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? "Untitled workspace",
    slug: (row.slug as string | null) ?? null,
    industry: (row.demo_industry as string | null) ?? null,
    scenario: (row.demo_scenario as string | null) ?? null,
    templateReady: Boolean(findDemoTemplate(row.demo_industry as string | null, row.demo_scenario as string | null)),
  }));

  const invitationsResult = await supabase
    .from("demo_invitations")
    .select("id, client_id, expires_at, revoked_at, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(100);
  if (invitationsResult.error) {
    return {
      accessOpen: accessMessage == null,
      accessMessage,
      workspaces,
      invitations: [],
      error: "Invitations could not be loaded.",
    };
  }

  const invitationRows = invitationsResult.data ?? [];
  const invitationIds = invitationRows.map((row) => row.id as string);
  const creatorIds = [...new Set(invitationRows.map((row) => row.created_by as string | null).filter((id): id is string => Boolean(id)))];
  const [sessionsResult, creatorsResult] = await Promise.all([
    invitationIds.length
      ? supabase.from("demo_sessions").select("invitation_id, expires_at, revoked_at").in("invitation_id", invitationIds)
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length
      ? supabase.from("users").select("id, name").in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const openByInvitation = new Map<string, number>();
  for (const session of sessionsResult.data ?? []) {
    const revoked = session.revoked_at as string | null;
    const expires = Date.parse(session.expires_at as string);
    if (revoked || expires <= now) continue;
    const invitationId = session.invitation_id as string;
    openByInvitation.set(invitationId, (openByInvitation.get(invitationId) ?? 0) + 1);
  }
  const creatorNames = new Map<string, string>();
  for (const user of creatorsResult.data ?? []) {
    if (user.name) creatorNames.set(user.id as string, user.name as string);
  }
  const workspaceNames = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));

  const invitations: DemoInvitationRecord[] = invitationRows.map((row) => {
    const revokedAt = (row.revoked_at as string | null) ?? null;
    const expiresAt = row.expires_at as string;
    const clientId = row.client_id as string;
    const createdBy = (row.created_by as string | null) ?? null;
    return {
      id: row.id as string,
      clientId,
      workspaceName: workspaceNames.get(clientId) ?? "Removed workspace",
      createdAt: row.created_at as string,
      expiresAt,
      revokedAt,
      createdByName: createdBy ? creatorNames.get(createdBy) ?? null : null,
      openSessions: openByInvitation.get(row.id as string) ?? 0,
      status: invitationStatus({ revokedAt, expiresAt }, now),
    };
  });

  return {
    accessOpen: accessMessage == null,
    accessMessage,
    workspaces,
    invitations,
    error: null,
  };
}
