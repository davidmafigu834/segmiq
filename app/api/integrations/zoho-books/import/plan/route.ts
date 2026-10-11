import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { parseZohoIdList } from "@/lib/zoho-books/import-plan";
import { zohoRouteError } from "@/lib/zoho-books/route-response";
import { planBooksImport } from "@/lib/zoho-books/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { customers?: unknown; items?: unknown } | null;
  const customers = parseZohoIdList(body?.customers ?? []);
  const items = parseZohoIdList(body?.items ?? []);
  if (!customers || !items) {
    return NextResponse.json({ error: "Select up to five customers and five items." }, { status: 400 });
  }
  try {
    const plan = await planBooksImport(gate.actor.clientId, gate.actor.userId, { customerIds: customers, itemIds: items });
    return NextResponse.json(plan);
  } catch (error) {
    return zohoRouteError(error);
  }
}
