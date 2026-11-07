import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDocumentInvitation } from "@/lib/real-estate/compliance-management/service";
import { lawyerDocumentAccess } from "@/lib/real-estate/workflow/journey";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { clientId: string; transactionId: string } }) {
  const guard = await requireClientAccessFromRequest(req, params.clientId);
  if (guard.error) return guard.error;
  if (guard.session.role !== "CLIENT_MANAGER" && guard.session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "A manager invites the lawyer." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as { requirementKeys?: string[]; documentId?: string; recipientId?: string };
  let requirementKeys = body.requirementKeys ?? [];
  const supabase = createAdminClient();
  const { data: txn } = await supabase.from("real_estate_transactions").select("id, compliance_case_id, client_id").eq("id", params.transactionId).eq("client_id", params.clientId).maybeSingle();
  if (!txn?.compliance_case_id) return NextResponse.json({ error: "Open the transaction compliance case before inviting a lawyer." }, { status: 409 });
  if (!requirementKeys.length) {
    const { data: requirements } = await supabase.from("compliance_case_requirements").select("requirement_key").eq("client_id", params.clientId).eq("compliance_case_id", txn.compliance_case_id as string);
    requirementKeys = (requirements ?? []).map((row) => row.requirement_key as string);
  }
  const invited = await createDocumentInvitation({
    clientId: params.clientId,
    session: guard.session,
    caseId: txn.compliance_case_id as string,
    requirementKeys,
    purpose: "submission",
  });
  if (!invited.ok) return NextResponse.json({ error: invited.error }, { status: invited.status });
  const access = lawyerDocumentAccess({
    clientId: params.clientId,
    transactionId: params.transactionId,
    documentId: body.documentId ?? "shared",
    sharedDocumentIds: body.documentId ? [body.documentId] : ["shared"],
    invitationClientId: params.clientId,
    invitationTransactionId: params.transactionId,
    recipientId: body.recipientId ?? "lawyer",
    actorRecipientId: body.recipientId ?? "lawyer",
    expiresAt: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
    revokedAt: null,
    nowMs: Date.now(),
  });
  return NextResponse.json({ invitationId: invited.invitationId, path: invited.path, access: access.ok });
}
