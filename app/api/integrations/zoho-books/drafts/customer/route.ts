import { NextResponse } from "next/server";
import { requireDraftActor } from "@/lib/zoho-books/draft-access";
import { createBooksCustomer, reconcileBooksCustomer } from "@/lib/zoho-books/draft-service";
import { zohoRouteError } from "@/lib/zoho-books/route-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    quotationId?: unknown;
    confirm?: unknown;
    reconcile?: unknown;
    confirmNotCreated?: unknown;
  } | null;
  const quotationId = typeof body?.quotationId === "string" ? body.quotationId : "";
  const actor = await requireDraftActor(req, quotationId);
  if ("response" in actor) return actor.response;
  try {
    const result = body?.reconcile === true
      ? await reconcileBooksCustomer({
          clientId: actor.clientId,
          userId: actor.userId,
          quotationId,
          confirmNotCreated: body.confirmNotCreated === true,
        })
      : await createBooksCustomer({
          clientId: actor.clientId,
          userId: actor.userId,
          quotationId,
          confirm: body?.confirm === true,
        });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return zohoRouteError(error);
  }
}
