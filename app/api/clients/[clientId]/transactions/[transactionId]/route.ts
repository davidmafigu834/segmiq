import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import {
  assertRealEstateClient,
  getRealEstateTransactionDetail,
  mutateRealEstateTransaction,
  updateTransactionMilestone,
} from "@/lib/real-estate/transaction-service";
import {
  RE_MILESTONE_STATUSES,
  type ReMilestoneStatus,
  type ReTxnAction,
} from "@/lib/real-estate/transactions";

export const dynamic = "force-dynamic";

const TXN_ACTIONS = [
  "start_progress",
  "complete",
  "fallen_through",
  "cancel",
  "record_deposit",
  "sign_agreement",
  "update_commission",
  "update_notes",
  "set_expected_completion",
  "update_milestone",
] as const;

const patchSchema = z.object({
  action: z.enum(TXN_ACTIONS),
  deposit_amount: z.number().nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  listing_pct: z.number().nullable().optional(),
  selling_pct: z.number().nullable().optional(),
  expected_completion_date: z.string().nullable().optional(),
  compliance_approved: z.boolean().optional(),
  milestone_id: z.string().uuid().optional(),
  status: z.enum(RE_MILESTONE_STATUSES).optional(),
});

function actorFromSession(session: {
  userId: string;
  role: string;
  clientId?: string | null;
  user?: { name?: string | null };
}) {
  return {
    id: session.userId,
    name: session.user?.name ?? "User",
    role: session.role,
    clientId: session.clientId ?? null,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string; transactionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const result = await getRealEstateTransactionDetail({
    clientId: params.clientId,
    transactionId: params.transactionId,
    actor: actorFromSession(session),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; transactionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const actor = actorFromSession(session);

  if (body.action === "update_milestone") {
    if (!body.milestone_id || !body.status) {
      return NextResponse.json(
        { error: "milestone_id and status required for update_milestone." },
        { status: 400 }
      );
    }
    const result = await updateTransactionMilestone({
      clientId: params.clientId,
      transactionId: params.transactionId,
      milestoneId: body.milestone_id,
      actor,
      status: body.status as ReMilestoneStatus,
      notes: body.notes,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  }

  const result = await mutateRealEstateTransaction({
    clientId: params.clientId,
    transactionId: params.transactionId,
    actor,
    action: body.action as ReTxnAction,
    depositAmount: body.deposit_amount,
    reason: body.reason,
    notes: body.notes,
    listingPct: body.listing_pct,
    sellingPct: body.selling_pct,
    expectedCompletionDate: body.expected_completion_date,
    complianceApproved: body.compliance_approved,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ transaction: result.transaction });
}
