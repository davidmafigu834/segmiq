import type { PermissionActor } from "@/lib/auth/rbac";
import {
  canAssignSocialInbox,
  canManageSocialChannels,
  canReplySocialInbox,
  canViewTeamSocialInbox,
} from "./access";
import { computeIndicators, matchesView, sortQueue } from "./ranking";
import { listConnections, listConversations, listTeam, rowToQueueItem } from "./store";
import { SOCIAL_INBOX_VIEWS } from "./types";
import type {
  SocialInboxFilters,
  SocialInboxViewCounts,
  SocialInboxViewId,
  SocialInboxWorkspace,
  SocialQueueItem,
} from "./types";

function countViews(items: SocialQueueItem[]): SocialInboxViewCounts {
  const counts = {} as SocialInboxViewCounts;
  for (const view of SOCIAL_INBOX_VIEWS) {
    counts[view] = items.filter((item) => matchesView(item, view)).length;
  }
  return counts;
}

export async function getSocialInboxWorkspace(opts: {
  actor: PermissionActor;
  view: SocialInboxViewId;
  filters?: SocialInboxFilters;
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

  const connections = (await listConnections(clientId)).filter((c) => !c.isDemo);
  const live = connections.filter((c) => c.status !== "disconnected");
  if (!live.length) {
    return {
      ...emptyWorkspace(opts.view, caps),
      connections,
      connectionState: connections.length ? "attention" : "none",
      team: await listTeam(clientId),
    };
  }

  const { rows } = await listConversations({
    clientId,
    viewerId: opts.actor.userId,
    canViewTeam,
    filters: opts.filters,
  });

  let items = rows.map((row) => rowToQueueItem(row, opts.actor.userId)).filter((item) => !item.isDemo);
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
  items = sortQueue(items, opts.view, opts.actor.userId);

  const attention = connections.some(
    (c) => c.status === "attention_required" || c.status === "auth_expired" || c.status === "sync_issue"
  );

  return {
    view: opts.view,
    items,
    counts: countViews(items),
    nextCursor: null,
    indicators: computeIndicators(items),
    connections,
    connectionState: attention ? "attention" : "connected",
    ...caps,
    team: await listTeam(clientId),
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
    counts: countViews([]),
    nextCursor: null,
    indicators: { highIntent: 0, awaitingReply: 0, followUpsDue: 0, openDealsNeedingAttention: 0 },
    connections: [],
    connectionState: "none",
    ...caps,
    team: [],
  };
}
