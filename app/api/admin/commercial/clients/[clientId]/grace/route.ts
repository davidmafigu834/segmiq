import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateGracePeriod } from "@/lib/commercial/grace";
import { commercialWritesEnabled } from "@/lib/commercial/plan-change";
import { checkCommercialWrite } from "@/lib/commercial-launch/control";
import { assertSameOrigin } from "@/lib/platform-sales/http";

const grantSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().min(3).max(500),
  customerNotified: z.literal(false).default(false),
});
const endSchema = z.object({
  graceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating)
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
    const input = grantSchema.parse(await request.json());
    validateGracePeriod({
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason,
    });
    const { data, error } = await createAdminClient().rpc(
      "platform_grant_grace_period",
      {
        p_client_id: params.clientId,
        p_actor_user_id: auth.session.userId,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_reason: input.reason,
        p_customer_notified: false,
      },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ graceId: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Grace period failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.isImpersonating)
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
    const input = endSchema.parse(await request.json());
    const { data, error } = await createAdminClient().rpc(
      "platform_end_grace_period",
      {
        p_client_id: params.clientId,
        p_grace_id: input.graceId,
        p_actor_user_id: auth.session.userId,
        p_reason: input.reason,
      },
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ graceId: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Grace period could not be ended",
      },
      { status: 400 },
    );
  }
}
