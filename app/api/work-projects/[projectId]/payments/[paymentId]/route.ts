import { NextResponse } from "next/server";
import { z } from "zod";
import { attachPaymentProof, confirmProjectPayment, reverseProjectPayment } from "@/lib/work-projects/commercial-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["confirm", "reverse", "proof"]),
  reason: z.string().max(500).optional(),
  refund: z.boolean().optional(),
  documentId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; paymentId: string } }
) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the payment update." }, { status: 400 });
  if (body.data.action === "confirm") {
    const result = await confirmProjectPayment(actor, params.projectId, params.paymentId);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (body.data.action === "proof") {
    if (!body.data.documentId) return NextResponse.json({ error: "Choose a document." }, { status: 400 });
    const result = await attachPaymentProof(actor, params.projectId, params.paymentId, body.data.documentId);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  const result = await reverseProjectPayment(actor, params.projectId, params.paymentId, body.data.reason || "", Boolean(body.data.refund));
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
