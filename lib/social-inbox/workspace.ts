import type { PermissionActor } from "@/lib/auth/rbac";
import {
  canAssignSocialInbox,
  canManageSocialChannels,
  canReplySocialInbox,
  canViewTeamSocialInbox,
} from "./access";
import { getDemoWorkspace } from "./demo-data";
import { computeIndicators, matchesView, sortQueue } from "./ranking";
import { listConnections, listConversations, listTeam, rowToQueueItem } from "./store";
import type { SocialInboxFilters, SocialInboxViewId, SocialInboxWorkspace } from "./types";

export async function getSocialInboxWorkspace(opts: {
  actor: PermissionActor;
  view: SocialInboxViewId;
  filters?: SocialInboxFilters;
  demo?: boolean;
}): Promise<SocialInboxWorkspace> {
  const clientId = opts.actor.clientId;
  if (!clientId) {
    return emptyWorkspace(opts.view, {
      canViewUnassigned: false,
      canManageChannels: false,
      canAssign: false,
      canReply: false,
    });
  }

  const canViewTeam = canViewTeamSocialInbox(opts.actor);
  const caps = {
    canViewUnassigned: canViewTeam,
    canManageChannels: canManageSocialChannels(opts.actor),
    canAssign: canAssignSocialInbox(opts.actor),
    canReply: canReplySocialInbox(opts.actor),
  };

  const connections = await listConnections(clientId);
  const realConnections = connections.filter((c) => !c.isDemo);
  const wantsDemo = opts.demo === true && realConnections.length === 0;
  const noneConnected = realConnections.length === 0 && connections.length === 0;

  if (wantsDemo || (noneConnected && process.env.SOCIAL_INBOX_DEMO === "1")) {
    const demo = getDemoWorkspace({
      view: opts.view,
      viewerId: opts.actor.userId,
      ...caps,
    });
    demo.team = await listTeam(clientId);
    return demo;
  }

  if (noneConnected) {
    return {
      ...emptyWorkspace(opts.view, caps),
      connections,
      connectionState: "none",
      team: await listTeam(clientId),
    };
  }

  const { rows, errorMissingTable } = await listConversations({
    clientId,
    viewerId: opts.actor.userId,
    view: opts.view,
    canViewTeam,
    filters: opts.filters,
  });

  if (errorMissingTable && process.env.NODE_ENV !== "production") {
    return getDemoWorkspace({
      view: opts.view,
      viewerId: opts.actor.userId,
      ...caps,
    });
  }

  let items = rows.map((row) => rowToQueueItem(row, opts.actor.userId));
  if (opts.filters?.channel === "facebook") {
    items = items.filter((i) => i.channel.startsWith("facebook"));
  } else if (opts.filters?.channel === "instagram") {
    items = items.filter((i) => i.channel.startsWith("instagram"));
  } else if (opts.filters?.channel) {
    items = items.filter((i) => i.channel === opts.filters?.channel);
  }
  if (opts.filters?.intentBand) {
    items = items.filter((i) => i.intentBand === opts.filters?.intentBand);
  }
  if (opts.filters?.assignedToId) {
    items = items.filter((i) => i.assignedToId === opts.filters?.assignedToId);
  }
  if (opts.filters?.q?.trim()) {
    const q = opts.filters.q.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.displayName.toLowerCase().includes(q) ||
        (i.username ?? "").toLowerCase().includes(q) ||
        i.preview.toLowerCase().includes(q) ||
        (i.detectedProduct ?? "").toLowerCase().includes(q)
    );
  }
  items = items.filter((i) => matchesView(i, opts.view));
  items = sortQueue(items, opts.view, opts.actor.userId);

  const attention = connections.some(
    (c) => c.status === "attention_required" || c.status === "auth_expired" || c.status === "sync_issue"
  );

  return {
    view: opts.view,
    items,
    nextCursor: null,
    indicators: computeIndicators(items),
    connections,
    connectionState: attention ? "attention" : "connected",
    ...caps,
    team: await listTeam(clientId),
    isDemo: false,
  };
}

function emptyWorkspace(
  view: SocialInboxViewId,
  caps: Pick<
    SocialInboxWorkspace,
    "canViewUnassigned" | "canManageChannels" | "canAssign" | "canReply"
  >
): SocialInboxWorkspace {
  return {
    view,
    items: [],
    nextCursor: null,
    indicators: { highIntent: 0, awaitingReply: 0, followUpsDue: 0, openDealsNeedingAttention: 0 },
    connections: [],
    connectionState: "none",
    ...caps,
    team: [],
    isDemo: false,
  };
}
