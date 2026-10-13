import { getGuestContext } from "@/lib/demo/context";
import { isDemoDeployment } from "@/lib/demo/deployment";
import { isDemoWorkspaceId } from "@/lib/demo/mode";

export type EgressChannel =
  | "email"
  | "whatsapp-campaign"
  | "whatsapp-gateway"
  | "zoho"
  | "agent-tool"
  | "storage"
  | "whatsapp";

/**
 * Refuse external effects. This is not a simulated success.
 *
 * An isolated demo deployment refuses every send.
 * On the shared production deployment, only a guest context or a demo
 * workspace is refused. A normal production call with no client id, such as
 * a platform email, is still allowed.
 */
export function decideEgress(input: {
  deploymentDemo: boolean;
  guest: boolean;
  workspaceDemo: boolean;
}): "allow" | "refuse" {
  if (input.deploymentDemo || input.guest || input.workspaceDemo) return "refuse";
  return "allow";
}

export async function egressDecision(input?: {
  clientId?: string | null;
}): Promise<"allow" | "refuse"> {
  const guest = Boolean(getGuestContext());
  const deploymentDemo = isDemoDeployment();
  let workspaceDemo = false;
  if (!deploymentDemo && !guest && input?.clientId) {
    workspaceDemo = await isDemoWorkspaceId(input.clientId);
  }
  return decideEgress({ deploymentDemo, guest, workspaceDemo });
}

export const DEMO_EGRESS_BLOCKED = "DEMO_EGRESS_BLOCKED";
