import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { zohoRouteError } from "@/lib/zoho-books/route-response";
import { listBooksInvoices } from "@/lib/zoho-books/sync";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  try {
    const result = await listBooksInvoices(gate.actor.clientId);
    return NextResponse.json(result);
  } catch (error) {
    return zohoRouteError(error);
  }
}
