import { getGuestContext } from "@/lib/demo/context";
import { DemoAccessDenied } from "@/lib/demo/errors";

/**
 * Tables a guest may touch through the generic service-role client.
 * `clients` is not on this list. Organisation rows are read only by
 * `readPinnedDemoWorkspace`, which is locked to the session's workspace id.
 */
const GUEST_SERVICE_ROLE_TABLES = new Set([
  "demo_invitations",
  "demo_sessions",
  "demo_session_mutations",
]);

export function guestMayUseServiceRoleTable(table: string): boolean {
  return GUEST_SERVICE_ROLE_TABLES.has(table);
}

/** Guests fail closed on any other service-role table or RPC. */
export function assertGuestRepositoryAccess(table: string): void {
  if (!getGuestContext()) return;
  if (!guestMayUseServiceRoleTable(table)) throw new DemoAccessDenied();
}
