import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { getRealEstateOfferDetail, mutateRealEstateOffer, assertRealEstateClient } from "@/lib/real-estate/offer-service";
import type { ReOfferAction } from "@/lib/real-estate/offers";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  action: z.enum(["submit", "counter", "revise", "accept", "reject", "withdraw", "note", "edit_draft"]),
  amount: z.number().positive().nullable().optional(),
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
  _req: Request,
  { params }: { params: { clientId: string; offerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  return NextResponse.json({
    offer: result.offer,
    notifyAvailable: result.notifyAvailable,
    siblingActiveCount: result.siblingActiveCount,
  });
}
