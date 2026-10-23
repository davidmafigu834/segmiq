import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { buildMigrationPreview } from "@/lib/commercial/amendment-service";
import { commercialWritesEnabled } from "@/lib/commercial/plan-change";
import { checkCommercialWrite } from "@/lib/commercial-launch/control";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth || auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const writeDecision = await checkCommercialWrite({
    clientId: params.clientId,
    environmentKillSwitchOpen: commercialWritesEnabled(),
  });
  if (!writeDecision.allowed)
    return NextResponse.json(
      {
        error: "Commercial writes are disabled pending release verification",
        reason: writeDecision.reason,
      },
      { status: 409 },
    );
  try {
    assertSameOrigin(request);
    const { input, proposed, legacy } = await buildMigrationPreview(
      params.clientId,
      await request.json(),
      { requireEffectiveNow: true },
    );
    if (!input.agreementRef || input.agreementRef.trim().length < 3)
      throw new Error("Customer consent evidence is required for migration");
    const { data, error } = await createAdminClient().rpc(
      "platform_migrate_commercial_account",
      {
        p_client_id: params.clientId,
        p_actor_user_id: auth.session.userId,
        p_legacy_subscription_id: legacy.subscriptionId,
        p_proposed_snapshot: proposed,
        p_effective_at: input.effectiveAt,
        p_charge_handling: input.chargeHandling,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
        p_agreement_ref: input.agreementRef,
      },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ changeRequestId: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 400 },
    );
  }
}
