import { NextResponse } from "next/server";
import { z } from "zod";
import { canModifyLead } from "@/lib/auth/permissions";
import { createDealFromLead } from "@/lib/sales/deals";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  serviceSummary: z.string().max(500).nullable().optional(),
  stage: z
    .enum(["QUALIFIED", "SCOPING", "PROPOSAL_SENT", "NEGOTIATING"])
    .optional(),
  customerNeed: z.string().max(2000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  buyingTimeframe: z.string().max(120).nullable().optional(),
  decisionMakerStatus: z.enum(["YES", "NO", "UNKNOWN"]).nullable().optional(),
  decisionMakerName: z.string().max(200).nullable().optional(),
  expectedDecisionAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  customerBudget: z.number().nonnegative().nullable().optional(),
  salesEstimate: z.number().nonnegative().nullable().optional(),
  estimatedValue: z.number().nonnegative().nullable().optional(),
  estimatedValueMin: z.number().nonnegative().nullable().optional(),
  estimatedValueMax: z.number().nonnegative().nullable().optional(),
  valuePending: z.boolean().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  nextActionLabel: z.string().max(300).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { leadId: string } }
) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await createDealFromLead({
    leadId: params.leadId,
    actorId: check.userId,
    ...parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    deal: result.deal,
    alreadyExisted: result.alreadyExisted,
  });
}
