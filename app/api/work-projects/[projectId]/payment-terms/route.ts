import { NextResponse } from "next/server";
import { z } from "zod";
import { PAYMENT_TRIGGERS } from "@/lib/work-projects/commercial-rules";
import { addPaymentTerm, importPaymentSchedule, setPaymentRequired } from "@/lib/work-projects/commercial-service";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["import", "add", "requirement"]),
  label: z.string().max(200).optional(),
  termType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  percent: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  trigger: z.enum(PAYMENT_TRIGGERS as unknown as [string, ...string[]]).optional(),
  dueDate: z.string().nullable().optional(),
  required: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the payment schedule." }, { status: 400 });
  if (body.data.action === "import") {
    const result = await importPaymentSchedule(actor, params.projectId);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (body.data.action === "requirement") {
    const result = await setPaymentRequired(actor, params.projectId, Boolean(body.data.required));
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  const result = await addPaymentTerm(actor, params.projectId, {
    label: body.data.label || "",
    termType: body.data.termType || "PERCENTAGE",
    percent: body.data.percent,
    amount: body.data.amount,
    trigger: body.data.trigger || "OTHER",
    dueDate: body.data.dueDate,
  });
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data, { status: 201 });
}
