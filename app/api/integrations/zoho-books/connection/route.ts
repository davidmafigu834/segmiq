import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { zohoBooksMissingConfig } from "@/lib/zoho-books/config";
import { ZOHO_BOOKS_REGIONS } from "@/lib/zoho-books/regions";
import { ZohoBooksRequestError } from "@/lib/zoho-books/http";
import { disconnectZohoBooks, migrationRequired, readPublicConnection } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (migrationRequired(error)) {
    return NextResponse.json(
      { error: "Apply the Zoho Books database migration before connecting.", migrationRequired: true },
      { status: 503 }
    );
  }
  if (error instanceof ZohoBooksRequestError) {
    return NextResponse.json(
      { error: error.message, reconnect: error.revoked },
      { status: error.status || 502 }
    );
  }
  return NextResponse.json({ error: "Zoho Books could not be reached." }, { status: 502 });
}

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const missing = zohoBooksMissingConfig();
  try {
    const connection = await readPublicConnection(gate.actor.clientId);
    return NextResponse.json({
      configured: missing.length === 0,
      missing,
      migrationRequired: false,
      supportedRegions: ZOHO_BOOKS_REGIONS.map((region) => ({ location: region.location, label: region.label })),
      connection,
    });
  } catch (error) {
    if (migrationRequired(error)) {
      return NextResponse.json({
        configured: missing.length === 0,
        missing,
        migrationRequired: true,
        supportedRegions: ZOHO_BOOKS_REGIONS.map((region) => ({ location: region.location, label: region.label })),
        connection: null,
      });
    }
    return failure(error);
  }
}

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "disconnect") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  try {
    const connection = await disconnectZohoBooks(gate.actor.clientId, gate.actor.userId);
    return NextResponse.json({ connection });
  } catch (error) {
    return failure(error);
  }
}
