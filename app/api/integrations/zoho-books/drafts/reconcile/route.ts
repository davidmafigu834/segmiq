import { NextResponse } from "next/server";
import { draftKind, requireDraftActor } from "@/lib/zoho-books/draft-access";
import { reconcileBooksDraft } from "@/lib/zoho-books/draft-service";
import { zohoRouteError } from "@/lib/zoho-books/route-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    quotationId?: unknown;
    kind?: unknown;
    confirmNotCreated?: unknown;
  } | null;
  const quotationId = typeof body?.quotationId === "string" ? body.quotationId : "";
  const kind = draftKind(body?.kind);
  if (!kind) return NextResponse.json({ error: "Choose an estimate or an invoice." }, { status: 400 });
  const actor = await requireDraftActor(req, quotationId);
  if ("response" in actor) return actor.response;
  try {
    const result = await reconcileBooksDraft({
      clientId: actor.clientId,
      userId: actor.userId,
      quotationId,
      kind,
      confirmNotCreated: body?.confirmNotCreated === true,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return zohoRouteError(error);
  }
}
