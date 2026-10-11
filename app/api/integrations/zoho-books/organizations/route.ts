import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { ZohoBooksRequestError } from "@/lib/zoho-books/http";
import { listAuthorisedOrganisations, migrationRequired, selectOrganisation } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
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

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  try {
    const organizations = await listAuthorisedOrganisations(gate.actor.clientId);
    return NextResponse.json({ organizations });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => null)) as { organizationId?: string; confirmChange?: boolean } | null;
  if (!body?.organizationId?.trim()) {
    return NextResponse.json({ error: "Choose an organisation from the list Zoho returned." }, { status: 400 });
  }
  try {
    const connection = await selectOrganisation({
      clientId: gate.actor.clientId,
      userId: gate.actor.userId,
      organizationId: body.organizationId,
      confirmChange: body.confirmChange === true,
    });
    return NextResponse.json({ connection });
  } catch (error) {
    return failure(error);
  }
}
