import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { considerReuse, getSubjectSummary, openSubjectCase } from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

const openSchema = z.object({
  context: z.enum(["buyer", "seller", "property", "transaction"]),
  contactId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
  customerType: z.enum(["individual", "company"]).optional(),
  legalRoute: z.enum(["title_deed", "cession", "other"]).optional(),
  reuse: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_subject" });
  if (access.error) return access.error;
  if (!(await assertRealEstateClient(params.clientId))) return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  const url = new URL(req.url);
  const context = url.searchParams.get("context");
  if (context !== "buyer" && context !== "seller" && context !== "property" && context !== "transaction") {
    return NextResponse.json({ error: "Choose a compliance context." }, { status: 400 });
  }
  const result = await getSubjectSummary({
    clientId: params.clientId,
    session: access.context.auth,
    supportAccess: !access.context.isTenantMember,
    context,
    contactId: url.searchParams.get("contactId"),
    listingId: url.searchParams.get("listingId"),
    transactionId: url.searchParams.get("transactionId"),
  });
  if ("ok" in result && result.ok === false) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_subject" });
  if (access.error) return access.error;
  if (!(await assertRealEstateClient(params.clientId))) return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  const parsed = openSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the highlighted fields.", details: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.reuse) {
    if (!parsed.data.contactId && !parsed.data.transactionId) return NextResponse.json({ error: "A case is required." }, { status: 400 });
    const summary = await getSubjectSummary({
      clientId: params.clientId,
      session: access.context.auth,
      supportAccess: !access.context.isTenantMember,
      context: parsed.data.context,
      contactId: parsed.data.contactId,
      listingId: parsed.data.listingId,
      transactionId: parsed.data.transactionId,
    });
    if ("ok" in summary && summary.ok === false) return NextResponse.json({ error: summary.error }, { status: summary.status });
    const caseId = "summary" in summary ? summary.summary?.caseId : null;
    if (!caseId) return NextResponse.json({ error: "Open the verification before checking reuse." }, { status: 400 });
    const reuse = await considerReuse({ clientId: params.clientId, session: access.context.auth, caseId: String(caseId) });
    if ("ok" in reuse && reuse.ok === false) return NextResponse.json({ error: reuse.error }, { status: reuse.status });
    return NextResponse.json(reuse);
  }
  const result = await openSubjectCase({
    clientId: params.clientId,
    session: access.context.auth,
    supportAccess: !access.context.isTenantMember,
    context: parsed.data.context,
    contactId: parsed.data.contactId,
    listingId: parsed.data.listingId,
    transactionId: parsed.data.transactionId,
    customerType: parsed.data.customerType,
    legalRoute: parsed.data.legalRoute,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}
