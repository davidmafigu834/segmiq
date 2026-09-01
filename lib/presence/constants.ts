/** Central presence thresholds — tune here only. */

/** User is online when lastSeenAt is within this window. */
export const PRESENCE_ONLINE_MS = 2 * 60 * 1000;

/** User is away when lastSeenAt is between online and this window. */
export const PRESENCE_AWAY_MS = 10 * 60 * 1000;

export type AvailabilityOverride = "AVAILABLE" | "AWAY" | "BUSY";

export type PresenceState = "online" | "away" | "busy" | "offline";

export const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};
