import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { correctDocumentFact, updateDocumentFactStatus } from "@/lib/documents/intelligence";
import { toDocumentActor } from "@/lib/documents/service";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject") }),
  z.object({
    action: z.literal("correct"),
    correctedValue: z.union([z.string(), z.number(), z.record(z.unknown())]),
    documentTypeCode: z.string().optional(),
  }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string; documentId: string; factId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const actor = toDocumentActor(g.session);

  if (parsed.data.action === "correct") {
    const result = await correctDocumentFact({
      clientId: params.clientId,
      documentId: params.documentId,
      factId: params.factId,
      actor,
      correctedValue: parsed.data.correctedValue,
      documentTypeCode: parsed.data.documentTypeCode,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  }

  const result = await updateDocumentFactStatus({
    clientId: params.clientId,
    documentId: params.documentId,
    factId: params.factId,
    actor,
    action: parsed.data.action,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
