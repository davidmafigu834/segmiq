import { NextResponse } from "next/server";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { openCaseEvidence } from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { clientId: string; caseId: string; evidenceId: string } }) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_evidence", resourceId: params.evidenceId });
  if (access.error) return access.error;
  if (!(await assertRealEstateClient(params.clientId))) return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  const result = await openCaseEvidence({ clientId: params.clientId, session: access.context.auth, caseId: params.caseId, evidenceId: params.evidenceId });
  if ("ok" in result && result.ok === false) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
