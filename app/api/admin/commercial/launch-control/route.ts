import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { launchModeInput } from "@/lib/commercial-launch/schemas";

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.PLATFORM_COMMERCIAL_LAUNCH_CONTROL_WRITES_ENABLED !== "true")
    return NextResponse.json(
      { error: "Launch-control writes are disabled." },
      { status: 503 },
    );
  try {
    assertSameOrigin(request);
    const input = launchModeInput.parse(await request.json());
    const { data, error } = await createAdminClient().rpc(
      "platform_set_commercial_release_mode",
      {
        p_actor_user_id: auth.session.userId,
        p_requested_mode: input.targetMode,
        p_expected_version: input.expectedVersion,
        p_reason: input.reason,
        p_evidence_refs: input.evidenceRefs,
        p_decision_owner: input.decisionOwner,
        p_rollback_owner: input.rollbackOwner,
        p_pilot_client_ids: input.pilotClientIds,
        p_idempotency_key: input.idempotencyKey,
      },
    );
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Release decision failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
