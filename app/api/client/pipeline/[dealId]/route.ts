import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-guards";
import { canModifyDeal, canReadDeal } from "@/lib/sales/deals/permissions";
import { canReassignLeads } from "@/lib/auth/permissions";
import {
  closeDealLost,
  closeDealWon,
  reassignDealOwner,
  updateDealFields,
  updateDealStage,
} from "@/lib/sales/deals";
import { getCompanyPipelineDealDetail } from "@/lib/sales/get-company-pipeline-page-data";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const clientId =
    new URL(req.url).searchParams.get("clientId") || session!.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const access = await canReadDeal(params.dealId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }
  if (access.deal.client_id !== clientId && session!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const detail = await getCompanyPipelineDealDetail({
      clientId: access.deal.client_id,
      dealId: params.dealId,
      actor: {
        userId: session!.userId,
        role: session!.role,
        clientId: session!.clientId,
        alsoSells: Boolean(session!.alsoSells),
      },
    });
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail });
  } catch (err) {
    console.error("[client/pipeline/deal]", err);
    return NextResponse.json({ error: "Failed to load Deal" }, { status: 500 });
  }
}

const patchSchema = z.object({
  stage: z.enum(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"]).optional(),
  ownerId: z.string().uuid().optional(),
  next_action_at: z.string().nullable().optional(),
  next_action_label: z.string().max(300).nullable().optional(),
  close: z
    .object({
      outcome: z.enum(["WON", "LOST"]),
      wonValue: z.number().nonnegative().optional(),
      lostReason: z.string().optional(),
      notes: z.string().max(2000).nullable().optional(),
    })
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { dealId: string } }
) {
  const guard = await requireRoles(["CLIENT_MANAGER", "SUPER_ADMIN"]);
  if (guard.error) return guard.error;
  const { session } = guard;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  const access = await canReadDeal(params.dealId, req);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: access.status === 401 ? 401 : 404 });
  }
  if (session!.role === "CLIENT_MANAGER" && session!.clientId !== access.deal.client_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (data.ownerId) {
    if (!canReassignLeads(session!, access.deal.client_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await reassignDealOwner({
      dealId: params.dealId,
      actorId: session!.userId,
      ownerId: data.ownerId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  const check = await canModifyDeal(params.dealId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  if (data.close?.outcome === "WON") {
    const result = await closeDealWon({
      dealId: params.dealId,
      actorId: check.userId,
      wonValue: data.close.wonValue ?? 0,
      notes: data.close.notes,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  if (data.close?.outcome === "LOST") {
    const result = await closeDealLost({
      dealId: params.dealId,
      actorId: check.userId,
      lostReason: data.close.lostReason ?? "",
      notes: data.close.notes,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  if (data.stage) {
    const result = await updateDealStage({
      dealId: params.dealId,
      actorId: check.userId,
      stage: data.stage,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  if (data.next_action_at !== undefined || data.next_action_label !== undefined) {
    const result = await updateDealFields({
      dealId: params.dealId,
      actorId: check.userId,
      patch: {
        next_action_at: data.next_action_at,
        next_action_label: data.next_action_label,
      },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ deal: result.deal });
  }

  return NextResponse.json({ error: "No updates" }, { status: 400 });
}
