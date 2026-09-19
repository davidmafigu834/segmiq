import { hasPermission, type PermissionActor } from "@/lib/auth/rbac";
import { P } from "@/lib/auth/rbac/permissions";
import type { SocialInboxActor } from "./types";

export function socialActorFrom(auth: PermissionActor & { name?: string | null }): SocialInboxActor | null {
  if (!auth.userId || !auth.clientId) return null;
  return {
    userId: auth.userId,
    role: auth.role,
    clientId: auth.clientId,
    alsoSells: auth.alsoSells ?? undefined,
    name: auth.name ?? null,
  };
}

export function canViewSocialInbox(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_VIEW) || hasPermission(actor, P.SOCIAL_INBOX_VIEW_TEAM);
}

export function canReplySocialInbox(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_REPLY);
}

export function canAssignSocialInbox(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_ASSIGN);
}

export function canViewTeamSocialInbox(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_VIEW_TEAM);
}

export function canManageSocialChannels(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_MANAGE_CHANNELS);
}

export function canConvertSocialLead(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_CONVERT_LEAD) && hasPermission(actor, P.LEADS_CREATE);
}

export function canCreateSocialDeal(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_CREATE_DEAL) && hasPermission(actor, P.DEALS_CREATE);
}

export function canCreateSocialQuote(actor: PermissionActor): boolean {
  return hasPermission(actor, P.SOCIAL_INBOX_CREATE_QUOTATION) && hasPermission(actor, P.QUOTES_CREATE);
}

export function canSeeConversation(opts: {
  actor: PermissionActor;
  assignedToId: string | null;
}): boolean {
  if (canViewTeamSocialInbox(opts.actor)) return true;
  if (!canViewSocialInbox(opts.actor)) return false;
  if (!opts.assignedToId) return false;
  return opts.assignedToId === opts.actor.userId;
}

export function assertSameClient(actorClientId: string, resourceClientId: string): boolean {
  return actorClientId === resourceClientId;
}
