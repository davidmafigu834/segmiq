import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { canAccessClient } from "@/lib/auth/permissions";
import { getRealEstateOfferDetail, mutateRealEstateOffer, assertRealEstateClient } from "@/lib/real-estate/offer-service";
import type { ReOfferAction } from "@/lib/real-estate/offers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["submit", "counter", "revise", "accept", "reject", "withdraw", "note", "edit_draft"]),
  amount: z.number().finite().positive().nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
  conditions: z.string().max(5000).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
  expected_updated_at: z.string().nullable().optional(),
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
  req: Request,
  { params }: { params: { clientId: string; offerId: string } }
) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const session = guard.session;
  if (!["SALESPERSON", "CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  if (!canAccessClient(session.role, session.clientId, params.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await assertRealEstateClient(params.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  }

  const result = await getRealEstateOfferDetail({
    clientId: params.clientId,
    offerId: params.offerId,
    actor: actorFromSession(session),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; offerId: string } }
) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  const session = guard.session;
  if (!["SALESPERSON", "CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
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
  if (req.headers.has("authorization") && !body.expected_updated_at) return NextResponse.json({ error: "expected_updated_at is required", code: "REVISION_REQUIRED" }, { status: 400 });
  const result = await mutateRealEstateOffer({
    clientId: params.clientId,
    offerId: params.offerId,
    actor: actorFromSession(session),
    action: body.action as ReOfferAction,
    amount: body.amount,
    note: body.note,
    conditions: body.conditions,
    expiryDate: body.expiry_date,
    reason: body.reason,
    expectedUpdatedAt: body.expected_updated_at,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (body.action === "accept") {
    try {
      const { startOrGetTransactionFromOffer } = await import(
        "@/lib/real-estate/transaction-service"
      );
      await startOrGetTransactionFromOffer({
        clientId: params.clientId,
        offerId: params.offerId,
        actor: actorFromSession(session),
      });
    } catch {
      // Soft-fail: offer accept must succeed even if transaction bootstrap fails.
    }
  }

  return NextResponse.json({
    offer: result.offer,
    notifyAvailable: result.notifyAvailable,
    siblingActiveCount: result.siblingActiveCount,
  });
}
