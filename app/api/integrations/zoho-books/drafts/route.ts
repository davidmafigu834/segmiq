import { NextResponse } from "next/server";
import { draftKind, requireDraftActor } from "@/lib/zoho-books/draft-access";
import { createBooksDraft, reviewBooksDraft } from "@/lib/zoho-books/draft-service";
import { zohoRouteError } from "@/lib/zoho-books/route-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const quotationId = url.searchParams.get("quotationId") ?? "";
  const kind = draftKind(url.searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Choose an estimate or an invoice." }, { status: 400 });
  const actor = await requireDraftActor(req, quotationId);
  if ("response" in actor) return actor.response;
  try {
    const result = await reviewBooksDraft({
      clientId: actor.clientId,
      quotationId,
      kind,
      stockAcknowledged: url.searchParams.get("stockAcknowledged") === "true",
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return zohoRouteError(error);
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    quotationId?: unknown;
    kind?: unknown;
    confirm?: unknown;
    stockAcknowledged?: unknown;
  } | null;
  const quotationId = typeof body?.quotationId === "string" ? body.quotationId : "";
  const kind = draftKind(body?.kind);
  if (!kind) return NextResponse.json({ error: "Choose an estimate or an invoice." }, { status: 400 });
  const actor = await requireDraftActor(req, quotationId);
  if ("response" in actor) return actor.response;
  try {
    const result = await createBooksDraft({
      clientId: actor.clientId,
      userId: actor.userId,
      quotationId,
      kind,
      confirm: body?.confirm === true,
      stockAcknowledged: body?.stockAcknowledged === true,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return zohoRouteError(error);
  }
}
