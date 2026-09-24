import type { SendResult } from "@/lib/messaging/log";
import { isDemoWorkspaceId } from "@/lib/demo/mode";
import type { WorkspaceMode } from "@/lib/demo/mode";

/** Pure check used by tests and by the send guards. */
export function demoBlocksExternalSend(mode: WorkspaceMode | null | undefined): boolean {
  return mode === "demo";
}

/**
 * Demo workspaces never call WhatsApp, email, SMS, or social providers.
 * A simulated success is returned so the UI can continue without a network send.
 * Nothing is written to provider logs.
 */
export async function simulatedExternalSend(
  clientId: string | null | undefined
): Promise<(SendResult & { simulated: true }) | null> {
  if (!clientId) return null;
  if (!(await isDemoWorkspaceId(clientId))) return null;
  return {
    ok: true,
    simulated: true,
    providerId: "demo-simulated",
    errorCode: "DEMO_SIMULATED",
  };
}
