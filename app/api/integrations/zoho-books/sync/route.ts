import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { zohoRouteError } from "@/lib/zoho-books/route-response";
import { discardBooksSync, readBooksOperatorStatus, stepBooksSync } from "@/lib/zoho-books/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  try {
    const status = await readBooksOperatorStatus(gate.actor.clientId);
    return NextResponse.json(status);
  } catch (error) {
    return zohoRouteError(error);
  }
}

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { discard?: unknown } | null;
  try {
    if (body?.discard === true) {
      const run = await discardBooksSync(gate.actor.clientId, gate.actor.userId);
      return NextResponse.json({ run });
    }
    const run = await stepBooksSync(gate.actor.clientId, gate.actor.userId);
    return NextResponse.json({ run });
  } catch (error) {
    return zohoRouteError(error);
  }
}
