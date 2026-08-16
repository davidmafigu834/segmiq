import type { ClientMode } from "@/types";

export type SettingsSession = {
  userId?: string | null;
  role?: string | null;
  clientId?: string | null;
  clientMode?: ClientMode | null;
};

/**
 * Company Settings is the company control center.
 * Team salespeople use their own sales profile; solo operators stay on /solo.
 */
export function resolveSettingsAccess(session: SettingsSession): "allow" | "deny" {
  if (!session.userId || !session.clientId) return "deny";
  if (session.role === "CLIENT_MANAGER" || session.role === "SUPER_ADMIN") return "allow";
  return "deny";
}
