import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createTaskFromObligation } from "@/lib/documents/obligations/create-task";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; documentId: string; obligationId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await createTaskFromObligation({
    clientId: params.clientId,
    documentId: params.documentId,
    obligationId: params.obligationId,
    actor: toDocumentActor(g.session),
    followUpDate: parsed.data.followUpDate,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    leadId: result.leadId,
    followUpDate: result.followUpDate,
    tasksHref: result.tasksHref,
  });
}
