import { NextResponse } from "next/server";
import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/work-projects/commercial-rules";
import { recordProjectPayment } from "@/lib/work-projects/commercial-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.number().positive(),
  paidAt: z.string(),
  method: z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]),
  reference: z.string().max(120).nullable().optional(),
  termId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the payment details." }, { status: 400 });
  const result = await recordProjectPayment(actor, params.projectId, body.data);
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: 201 });
}
