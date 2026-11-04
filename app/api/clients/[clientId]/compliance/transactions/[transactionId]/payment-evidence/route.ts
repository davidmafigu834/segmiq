import { NextResponse } from "next/server";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import { storePaymentProof } from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { clientId: string; transactionId: string } }) {
  const access = await requireClientDataAccess({ req, clientId: params.clientId, scope: "COMPLIANCE", resourceType: "compliance_payment", resourceId: params.transactionId });
  if (access.error) return access.error;
  if (!(await assertRealEstateClient(params.clientId))) return NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Store the payment file before marking evidence submitted." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await storePaymentProof({
    clientId: params.clientId,
    session: access.context.auth,
    transactionId: params.transactionId,
    filename: file.name,
    contentType: file.type,
    bytes,
  });
  if ("ok" in result && result.ok === false) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}
