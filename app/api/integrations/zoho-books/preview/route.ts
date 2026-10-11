import { NextResponse } from "next/server";
import { requireZohoBooksManager } from "@/lib/zoho-books/access";
import { ZohoBooksRequestError } from "@/lib/zoho-books/http";
import { clampPreviewPage } from "@/lib/zoho-books/import-plan";
import { migrationRequired, previewBooks } from "@/lib/zoho-books/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireZohoBooksManager(req);
  if (!gate.ok) return gate.response;
  try {
    const url = new URL(req.url);
    const preview = await previewBooks(gate.actor.clientId, {
      customerPage: clampPreviewPage(url.searchParams.get("customerPage")),
      itemPage: clampPreviewPage(url.searchParams.get("itemPage")),
    });
    return NextResponse.json({ preview: true, ...preview });
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
