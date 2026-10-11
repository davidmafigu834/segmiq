import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { parseDecisions } from "@/lib/zoho-books/import-plan";
import { zohoRouteError } from "@/lib/zoho-books/route-response";
import { stepProductCatalog } from "@/lib/zoho-books/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { runId?: unknown; decision?: unknown } | null;
  const runId = typeof body?.runId === "string" && body.runId.trim() ? body.runId.trim() : undefined;
  const decisions = body?.decision ? parseDecisions([body.decision]) : [];
  if (body?.decision && !decisions) {
    return NextResponse.json({ error: "Link the matching product or skip it." }, { status: 400 });
  }
  try {
    const run = await stepProductCatalog(gate.actor.clientId, gate.actor.userId, { runId, decision: decisions?.[0] });
    return NextResponse.json({ run });
  } catch (error) {
    return zohoRouteError(error);
  }
}
