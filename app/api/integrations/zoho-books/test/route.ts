import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { ZohoBooksRequestError } from "@/lib/zoho-books/http";
import { migrationRequired, testConnection } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  try {
    const connection = await testConnection(gate.actor.clientId, gate.actor.userId);
    return NextResponse.json({ connection });
  } catch (error) {
    if (migrationRequired(error)) {
      return NextResponse.json(
        { error: "Apply the Zoho Books database migration before connecting.", migrationRequired: true },
        { status: 503 }
      );
    }
    if (error instanceof ZohoBooksRequestError) {
      return NextResponse.json({ error: error.message, reconnect: error.revoked }, { status: error.status || 502 });
    }
    return NextResponse.json({ error: "Zoho Books could not be reached." }, { status: 502 });
  }
}
