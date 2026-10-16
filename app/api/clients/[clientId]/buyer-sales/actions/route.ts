import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { INTEREST_STATES, REJECTION_REASONS, VIEWING_OUTCOMES } from "@/lib/real-estate/buyer-match";
import {
  completeSearchViewing,
  createRentalApplication,
  linkEnquiryToSearch,
  requestBuyerIntroduction,
  rescheduleSearchViewing,
  reviewBuyerIntroduction,
  scheduleSearchViewing,
  setPropertyInterest,
  updateRentalDeposit,
  type BuyerActor,
} from "@/lib/real-estate/buyer-sales-service";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("interest"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    state: z.enum(INTEREST_STATES),
    rejectionReason: z.enum(REJECTION_REASONS).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("viewing"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    scheduledAt: z.string().min(1),
    confirmationStatus: z.enum(["tentative", "awaiting_confirmation", "confirmed"]).optional(),
    instructions: z.string().max(2000).nullable().optional(),
    confirmOverlap: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("reschedule_viewing"),
    viewingId: z.string().uuid(),
    scheduledAt: z.string().min(1),
    confirmOverlap: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("viewing_outcome"),
    viewingId: z.string().uuid(),
    outcome: z.enum(VIEWING_OUTCOMES),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("rental_application"),
    searchId: z.string().uuid(),
    listingId: z.string().uuid(),
    notes: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("deposit"),
    applicationId: z.string().uuid(),
    depositAction: z.enum(["report", "verify"]),
  }),
  z.object({
    action: z.literal("link_enquiry"),
    searchId: z.string().uuid(),
    leadId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("introduction"),
    listingId: z.string().uuid(),
    searchId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("review_introduction"),
    introductionId: z.string().uuid(),
    decision: z.enum(["accepted", "declined"]),
  }),
]);

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): BuyerActor {
  return { id: session.userId, name: session.user?.name ?? "Agent", role: session.role, clientId: session.clientId };
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const actor = actorFrom(g.session);
  const body = parsed.data;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  if (body.action === "interest") {
    const result = await setPropertyInterest({ clientId: params.clientId, actor, ...body, rejectionReason: body.rejectionReason ?? null });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "viewing") {
    const result = await scheduleSearchViewing({
      clientId: params.clientId,
      actor,
      ...body,
      idempotencyKey,
    });
    if (!result.ok) return NextResponse.json({ error: result.error, warning: "warning" in result ? result.warning : undefined }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  }
  if (body.action === "reschedule_viewing") {
    const result = await rescheduleSearchViewing({ clientId: params.clientId, actor, ...body });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "viewing_outcome") {
    const result = await completeSearchViewing({ clientId: params.clientId, actor, ...body });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "rental_application") {
    const result = await createRentalApplication({ clientId: params.clientId, actor, ...body });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  }
  if (body.action === "deposit") {
    const result = await updateRentalDeposit({
      clientId: params.clientId,
      actor,
      applicationId: body.applicationId,
      action: body.depositAction,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "link_enquiry") {
    const result = await linkEnquiryToSearch({ clientId: params.clientId, actor, ...body });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  }
  if (body.action === "introduction") {
    const result = await requestBuyerIntroduction({ clientId: params.clientId, actor, ...body });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  }
  const result = await reviewBuyerIntroduction({ clientId: params.clientId, actor, ...body });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
