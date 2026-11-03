import { NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/auth/resolveApiAuth";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { getSubjectSummary, mobileComplianceDto } from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

/**
 * Android-ready compliance summary.
 * Identity comes from the bearer or cookie session. Query clientId is ignored.
 * Contract: docs/android-integration/13-real-estate-compliance-mobile-contracts.md
 */
export async function GET(req: Request) {
  const session = await resolveApiAuth(req);
  if (!session?.userId || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!(await assertRealEstateClient(session.clientId))) {
    return NextResponse.json({ error: "Not a real-estate workspace.", code: "NOT_FOUND" }, { status: 404 });
  }
  const url = new URL(req.url);
  const context = url.searchParams.get("context");
  if (context !== "buyer" && context !== "seller" && context !== "property" && context !== "transaction") {
    return NextResponse.json({ error: "Choose a compliance context.", code: "INVALID_REQUEST" }, { status: 400 });
  }
  const result = await getSubjectSummary({
    clientId: session.clientId,
    session,
    context,
    contactId: url.searchParams.get("contactId"),
    listingId: url.searchParams.get("listingId"),
    transactionId: url.searchParams.get("transactionId"),
  });
  if ("ok" in result && result.ok === false) {
    return NextResponse.json({ error: result.error, code: result.code ?? "FORBIDDEN" }, { status: result.status });
  }
  const summary = "summary" in result ? result.summary : null;
  return NextResponse.json({
    schemaVersion: 1,
    context,
    summary: mobileComplianceDto(summary),
    caseId: summary?.caseId ?? null,
    enforced: "enforced" in result ? result.enforced : false,
  }, { headers: { "Cache-Control": "no-store" } });
}
