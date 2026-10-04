import type { UserRole } from "@/types";
import type { WorkProjectStatus } from "@/lib/work-projects/constants";

export type WorkProjectActor = {
  userId: string;
  role: UserRole | string;
  clientId: string | null;
};

export type WorkProjectAccessRow = {
  client_id: string;
  project_owner_id: string | null;
  deal_owner_id: string | null;
  member_user_ids: string[];
  status: WorkProjectStatus | string;
};

export function salespersonCanSeeProject(actorUserId: string, row: WorkProjectAccessRow): boolean {
  if (row.project_owner_id === actorUserId) return true;
  if (row.deal_owner_id === actorUserId) return true;
  return row.member_user_ids.includes(actorUserId);
}

export function canReadWorkProject(actor: WorkProjectActor, row: WorkProjectAccessRow): boolean {
  if (!actor.clientId || actor.clientId !== row.client_id) return false;
  if (actor.role === "SUPER_ADMIN" || actor.role === "CLIENT_MANAGER") return true;
  if (actor.role === "SALESPERSON") return salespersonCanSeeProject(actor.userId, row);
  return false;
}

export function canManageWorkProjects(actor: WorkProjectActor, clientId: string): boolean {
  if (!actor.clientId || actor.clientId !== clientId) return false;
  return actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN";
}

export function canUpdateWorkProject(actor: WorkProjectActor, row: WorkProjectAccessRow): boolean {
  if (!canReadWorkProject(actor, row)) return false;
  if (actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN") {
    return actor.clientId === row.client_id;
  }
  return actor.role === "SALESPERSON" && salespersonCanSeeProject(actor.userId, row);
}

export function canCancelOrReopenWorkProject(actor: WorkProjectActor, clientId: string): boolean {
  return canManageWorkProjects(actor, clientId);
}

export function canCreateManualWorkProject(actor: WorkProjectActor, clientId: string): boolean {
  return canCancelOrReopenWorkProject(actor, clientId);
}
