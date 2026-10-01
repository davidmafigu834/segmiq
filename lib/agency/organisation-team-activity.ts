import { formatDistanceStrict } from "date-fns";
import { roleLabel } from "@/lib/auth/impersonation";
import {
  PRESENCE_LABEL,
  type AvailabilityOverride,
  type PresenceState,
} from "@/lib/presence/constants";
import { derivePresenceState } from "@/lib/presence/derive-presence";

const LATEST_EVENTS_CAP = 500;

export type TeamActivityUserInput = {
  id: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastSeenAt: string | null;
  availabilityOverride: string | null;
};

/** Actor + time + whether the event sits on a deal. No customer record fields. */
export type TeamActivityEventInput = {
  actorId: string | null;
  createdAt: string;
  dealId: string | null;
};

export type OrganisationTeamMemberActivity = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
  presence: PresenceState;
  presenceLabel: string;
  lastOnlineLabel: string;
  lastSeenAt: string | null;
  workLabel: string;
};

export type OrganisationTeamActivity = {
  summary: {
    online: number;
    away: number;
    busy: number;
    offline: number;
    disabled: number;
  };
  members: OrganisationTeamMemberActivity[];
};

const PRESENCE_RANK: Record<PresenceState, number> = {
  online: 0,
  away: 1,
  busy: 2,
  offline: 3,
};

function asOverride(value: string | null): AvailabilityOverride | null {
  if (value === "AVAILABLE" || value === "AWAY" || value === "BUSY") return value;
  return null;
}

function relativeAgo(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${formatDistanceStrict(date, now)} ago`;
}

function latestEventByActor(events: TeamActivityEventInput[]): Map<string, TeamActivityEventInput> {
  const byActor = new Map<string, TeamActivityEventInput>();
  for (const event of events) {
    if (!event.actorId) continue;
    const seen = new Date(event.createdAt).getTime();
    if (Number.isNaN(seen)) continue;
    const current = byActor.get(event.actorId);
    if (!current || seen > new Date(current.createdAt).getTime()) {
      byActor.set(event.actorId, event);
    }
  }
  return byActor;
}

function workLabel(event: TeamActivityEventInput | undefined, now: Date): string {
  if (!event) return "No recorded work";
  const kind = event.dealId ? "Deal" : "Lead";
  return `${kind} · ${relativeAgo(event.createdAt, now)}`;
}

export function buildOrganisationTeamActivity(input: {
  users: TeamActivityUserInput[];
  events: TeamActivityEventInput[];
  now?: Date;
}): OrganisationTeamActivity {
  const now = input.now ?? new Date();
  const eventsByActor = latestEventByActor(input.events);

  const summary = { online: 0, away: 0, busy: 0, offline: 0, disabled: 0 };

  const members = input.users.map((user) => {
    const override = asOverride(user.availabilityOverride);
    const presence = user.isActive
      ? derivePresenceState({
          lastSeenAt: user.lastSeenAt,
          availabilityOverride: override,
          now,
        })
      : "offline";

    if (!user.isActive) summary.disabled += 1;
    else summary[presence] += 1;

    const lastOnlineLabel = !user.lastSeenAt
      ? "Never"
      : user.isActive && presence === "online"
        ? "Online now"
        : relativeAgo(user.lastSeenAt, now);

    return {
      id: user.id,
      name: user.name?.trim() || "Unnamed",
      role: user.role,
      roleLabel: roleLabel(user.role),
      isActive: user.isActive,
      presence,
      presenceLabel: user.isActive ? PRESENCE_LABEL[presence] : "Disabled",
      lastOnlineLabel,
      lastSeenAt: user.lastSeenAt,
      workLabel: workLabel(eventsByActor.get(user.id), now),
    };
  });

  members.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const rank = (member: OrganisationTeamMemberActivity) =>
      member.isActive && !member.lastSeenAt && member.presence === "offline"
        ? 4
        : PRESENCE_RANK[member.presence];
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB) return rankA - rankB;
    const seenA = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
    const seenB = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
    if (seenA !== seenB) return seenB - seenA;
    return a.name.localeCompare(b.name);
  });

  return { summary, members };
}

export async function fetchOrganisationTeamActivity(
  clientId: string
): Promise<OrganisationTeamActivity | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) return null;

  const [{ data: users, error: usersError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, role, is_active, last_seen_at, availability_override")
        .eq("client_id", clientId),
      supabase
        .from("lead_events")
        .select("actor_id, created_at, deal_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(LATEST_EVENTS_CAP),
    ]);

  if (usersError) throw new Error(usersError.message);
  if (eventsError) throw new Error(eventsError.message);

  return buildOrganisationTeamActivity({
    users: (users ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string | null) ?? null,
      role: String(row.role),
      isActive: row.is_active !== false,
      lastSeenAt: (row.last_seen_at as string | null) ?? null,
      availabilityOverride: (row.availability_override as string | null) ?? null,
    })),
    events: (events ?? []).map((row) => ({
      actorId: (row.actor_id as string | null) ?? null,
      createdAt: row.created_at as string,
      dealId: (row.deal_id as string | null) ?? null,
    })),
  });
}
