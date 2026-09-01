"use client";

import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";

/** Mount once inside authenticated sales/company shells. */
export function PresenceHeartbeat() {
  usePresenceHeartbeat(true);
  return null;
}
