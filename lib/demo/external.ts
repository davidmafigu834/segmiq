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
  const { isDemoDeployment } = await import("@/lib/demo/deployment");
  const { getGuestContext } = await import("@/lib/demo/context");
  if (!clientId && !isDemoDeployment() && !getGuestContext()) return null;
  if (isDemoDeployment() || getGuestContext() || (clientId && (await isDemoWorkspaceId(clientId)))) {
    return {
      ok: true,
      simulated: true,
      providerId: "demo-simulated",
      errorCode: "DEMO_SIMULATED",
    };
  }
  return null;
}
