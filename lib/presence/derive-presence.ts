import {
  PRESENCE_AWAY_MS,
  PRESENCE_ONLINE_MS,
  type AvailabilityOverride,
  type PresenceState,
} from "./constants";

export function derivePresenceState(opts: {
  lastSeenAt: string | null | undefined;
  availabilityOverride?: AvailabilityOverride | null;
  now?: Date;
}): PresenceState {
  const now = opts.now ?? new Date();
  const override = opts.availabilityOverride ?? null;

  if (override === "BUSY") return "busy";
  if (override === "AWAY") return "away";

  if (!opts.lastSeenAt) return "offline";

  const seen = new Date(opts.lastSeenAt);
  if (Number.isNaN(seen.getTime())) return "offline";

  const ageMs = now.getTime() - seen.getTime();
  if (ageMs <= PRESENCE_ONLINE_MS) return "online";
  if (ageMs <= PRESENCE_AWAY_MS) return "away";
  return "offline";
}
