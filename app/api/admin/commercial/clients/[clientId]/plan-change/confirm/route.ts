import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { buildPlanChangePreview } from "@/lib/commercial/amendment-service";
import { validateConsent } from "@/lib/commercial/plan-change";
import { assertSameOrigin } from "@/lib/platform-sales/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Operator plan changes stay available while public launch gates are off.
  try {
    assertSameOrigin(request);
    const { input, preview } = await buildPlanChangePreview(
      params.clientId,
      await request.json(),
    );
    validateConsent(preview, input.agreementRef);
    const { data, error } = await createAdminClient().rpc(
      "platform_apply_plan_change",
      {
        p_client_id: params.clientId,
        p_actor_user_id: auth.session.userId,
        p_expected_snapshot: preview.current,
        p_proposed_snapshot: preview.proposed,
        p_effective_at: preview.effectiveAt,
        p_charge_handling: input.chargeHandling,
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
        p_agreement_ref: input.agreementRef ?? null,
      },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ changeRequestId: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Plan change failed" },
      { status: 400 },
    );
  }
}
