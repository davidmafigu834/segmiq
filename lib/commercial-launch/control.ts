import { createAdminClient } from "@/lib/supabase/admin";
import { decideCommercialWrite } from "./gates";
import type { CommercialLaunchMode } from "./types";

type CommercialWriteDecision = {
  allowed: boolean;
  reason: string;
};

type ReleaseControl = {
  mode: CommercialLaunchMode;
  pilotClientIds: string[];
};

async function loadReleaseControl(): Promise<ReleaseControl | null> {
  const { data, error } = await createAdminClient()
    .from("platform_commercial_release_controls")
    .select("mode,pilot_client_ids")
    .eq("control_key", "commercial_v2")
    .maybeSingle();
  if (error || !data) return null;
  return {
    mode: data.mode as CommercialLaunchMode,
    pilotClientIds: (data.pilot_client_ids as string[] | null) ?? [],
  };
}

export async function checkCommercialWrite(
  input: {
    clientId: string;
    environmentKillSwitchOpen: boolean;
  },
  loader: () => Promise<ReleaseControl | null> = loadReleaseControl,
): Promise<CommercialWriteDecision> {
  if (!input.environmentKillSwitchOpen) {
    return { allowed: false, reason: "environment_disabled" };
  }

  try {
    const control = await loader();
    if (!control) {
      return { allowed: false, reason: "release_control_unavailable" };
    }

    return decideCommercialWrite({
      mode: control.mode,
      clientId: input.clientId,
      pilotClientIds: control.pilotClientIds,
      environmentKillSwitchOpen: input.environmentKillSwitchOpen,
    });
  } catch {
    return { allowed: false, reason: "release_control_unavailable" };
  }
}
