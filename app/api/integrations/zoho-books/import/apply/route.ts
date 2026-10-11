import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { parseDecisions } from "@/lib/zoho-books/import-plan";
import { zohoRouteError } from "@/lib/zoho-books/route-response";
import { applyBooksImport } from "@/lib/zoho-books/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { runId?: unknown; customers?: unknown; items?: unknown } | null;
  const customers = parseDecisions(body?.customers ?? []);
  const items = parseDecisions(body?.items ?? []);
  const runId = typeof body?.runId === "string" && body.runId.trim() ? body.runId.trim() : undefined;
  if (!customers || !items) {
    return NextResponse.json({ error: "Select up to five customers and five items." }, { status: 400 });
  }
  try {
    const run = await applyBooksImport(gate.actor.clientId, gate.actor.userId, { runId, customers, items });
    return NextResponse.json({ run });
  } catch (error) {
    return zohoRouteError(error);
  }
}
