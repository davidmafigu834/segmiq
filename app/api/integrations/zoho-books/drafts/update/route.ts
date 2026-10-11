import { NextResponse } from "next/server";
import { draftKind, requireDraftActor } from "@/lib/zoho-books/draft-access";
import { updateBooksDraft } from "@/lib/zoho-books/draft-service";
import { zohoRouteError } from "@/lib/zoho-books/route-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    quotationId?: unknown;
    kind?: unknown;
    confirmReplace?: unknown;
    acknowledgeBooksChanges?: unknown;
    stockAcknowledged?: unknown;
  } | null;
  const quotationId = typeof body?.quotationId === "string" ? body.quotationId : "";
  const kind = draftKind(body?.kind);
  if (!kind) return NextResponse.json({ error: "Choose an estimate or an invoice." }, { status: 400 });
  const actor = await requireDraftActor(req, quotationId);
  if ("response" in actor) return actor.response;
  try {
    const result = await updateBooksDraft({
      clientId: actor.clientId,
      userId: actor.userId,
      quotationId,
      kind,
      confirmReplace: body?.confirmReplace === true,
      acknowledgeBooksChanges: body?.acknowledgeBooksChanges === true,
      stockAcknowledged: body?.stockAcknowledged === true,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return zohoRouteError(error);
  }
}
