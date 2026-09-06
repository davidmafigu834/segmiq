import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessClient } from "@/lib/auth/permissions";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { mutateAfterSalesCase } from "@/lib/real-estate/after-sales-service";
import {
  AFTER_SALES_OUTCOMES,
  AFTER_SALES_STATUSES,
} from "@/lib/real-estate/after-sales";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(AFTER_SALES_STATUSES).optional(),
  outcome: z.enum(AFTER_SALES_OUTCOMES).nullable().optional(),
  satisfaction_score: z.number().int().min(1).max(5).nullable().optional(),
  future_needs_notes: z.string().max(5000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  due_at: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; caseId: string } }
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

  const result = await mutateAfterSalesCase({
    clientId: params.clientId,
    caseId: params.caseId,
    actor: {
      id: session.userId,
      name: session.user?.name ?? "User",
      role: session.role,
      clientId: session.clientId,
    },
    status: parsed.data.status,
    outcome: parsed.data.outcome,
    satisfactionScore: parsed.data.satisfaction_score,
    futureNeedsNotes: parsed.data.future_needs_notes,
    notes: parsed.data.notes,
    dueAt: parsed.data.due_at,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
