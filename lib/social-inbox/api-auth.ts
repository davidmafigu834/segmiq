import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/rbac";
import { P, type Permission } from "@/lib/auth/rbac/permissions";
import { canSeeConversation, socialActorFrom } from "./access";
import { getConversationRow } from "./store";
import type { SocialInboxActor } from "./types";

/**
 * Social Inbox conversations are client data.
 *
 * The SOCIAL_INBOX_* permissions are classified as client-data permissions
 * (lib/auth/rbac/permissions), so platform staff do not hold them by default and
 * the actor is always tenant-scoped — there is no clientId override here. Staff
 * see connection/sync health on the organisation page instead of DM contents.
 */
export async function requireSocialInbox(
  req: Request,
  permission: Permission = P.SOCIAL_INBOX_VIEW
): Promise<
  | { ok: true; actor: SocialInboxActor }
  | { ok: false; response: NextResponse }
> {
  const gate = await requirePermission(permission, req);
  if ("error" in gate) return { ok: false, response: gate.error };
  const actor = socialActorFrom(gate.auth);
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, actor };
}

export async function loadVisibleConversation(actor: SocialInboxActor, conversationId: string) {
  const row = await getConversationRow(actor.clientId, conversationId);
  if (!row) return null;
  if (!canSeeConversation({ actor, assignedToId: row.assigned_to_id })) return "forbidden" as const;
  return row;
}
