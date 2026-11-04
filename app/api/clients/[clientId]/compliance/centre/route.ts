import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientDataAccess } from "@/lib/security/support-access";
import { assertRealEstateClient } from "@/lib/real-estate/offer-service";
import {
  complianceCentre,
  completeWorkItem,
  createDocumentInvitation,
  decideRequirement,
  escalateCase,
  recordLegalMilestone,
  recordPaymentEvidence,
  revokeInvitation,
  savePolicyVersion,
} from "@/lib/real-estate/compliance-management/service";

export const dynamic = "force-dynamic";

const decision = z.object({
  action: z.literal("decide"),
  requirementId: z.string().uuid(),
  expectedState: z.enum(["not_started", "awaiting_information", "submitted", "under_review", "more_information_required", "verified", "rejected", "waived", "not_applicable"]),
  decision: z.enum(["verify", "request_changes", "reject", "waive", "start_review", "mark_not_applicable"]),
  reason: z.string().max(1000).optional(),
  customerInstruction: z.string().max(1000).optional(),
  internalNote: z.string().max(1000).optional(),
});

const invite = z.object({
  action: z.literal("invite"),
  caseId: z.string().uuid(),
  requirementKeys: z.array(z.string().min(1)).min(1).max(30),
  purpose: z.enum(["submission", "correction"]).default("submission"),
});

const policy = z.object({
  action: z.literal("save_policy"),
  templateKey: z.string().min(1),
  reviewNote: z.string().min(8).max(1000),
  activate: z.boolean().default(false),
  listingPublication: z.boolean().default(false),
  allowReuse: z.boolean().default(false),
});

const payment = z.object({
  action: z.literal("payment"),
  transactionId: z.string().uuid(),
  next: z.enum(["reported", "proof_uploaded", "under_verification", "independently_confirmed", "disputed", "rejected"]),
});

const legal = z.object({
  action: z.literal("legal_milestone"),
  transactionId: z.string().uuid(),
  milestoneKey: z.string().min(1),
  done: z.boolean(),
  note: z.string().max(500).optional(),
});

const escalate = z.object({
  action: z.literal("escalate"),
  caseId: z.string().uuid(),
  reason: z.string().min(8).max(1000),
});

const revoke = z.object({ action: z.literal("revoke"), invitationId: z.string().uuid() });
const work = z.object({ action: z.literal("complete_work"), workItemId: z.string().uuid() });
const bodySchema = z.discriminatedUnion("action", [decision, invite, policy, payment, legal, escalate, revoke, work]);

async function guard(req: Request, clientId: string) {
  const access = await requireClientDataAccess({ req, clientId, scope: "COMPLIANCE", resourceType: "compliance_centre" });
  if (access.error) return { error: access.error };
  if (!(await assertRealEstateClient(clientId))) {
    return { error: NextResponse.json({ error: "Not a real-estate workspace." }, { status: 404 }) };
  }
  return { access };
}

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const guarded = await guard(req, params.clientId);
  if ("error" in guarded && guarded.error) return guarded.error;
  const url = new URL(req.url);
  const section = url.searchParams.get("section") ?? "overview";
  const page = Number(url.searchParams.get("page") ?? "1");
  const result = await complianceCentre({
    clientId: params.clientId,
    session: guarded.access!.context.auth,
    supportAccess: !guarded.access!.context.isTenantMember,
    section,
    page: Number.isFinite(page) ? page : 1,
  });
  if ("ok" in result && result.ok === false) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const guarded = await guard(req, params.clientId);
  if ("error" in guarded && guarded.error) return guarded.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the highlighted fields.", details: parsed.error.flatten() }, { status: 400 });
  const session = guarded.access!.context.auth;
  const data = parsed.data;
  const result = data.action === "decide"
    ? await decideRequirement({ clientId: params.clientId, session, requirementId: data.requirementId, expectedState: data.expectedState, decision: data.decision, reason: data.reason, customerInstruction: data.customerInstruction, internalNote: data.internalNote })
    : data.action === "invite"
      ? await createDocumentInvitation({ clientId: params.clientId, session, caseId: data.caseId, requirementKeys: data.requirementKeys, purpose: data.purpose })
      : data.action === "save_policy"
        ? await savePolicyVersion({ clientId: params.clientId, session, templateKey: data.templateKey, reviewNote: data.reviewNote, activate: data.activate, enforcement: { listing_publication: data.listingPublication, allow_reuse: data.allowReuse } })
        : data.action === "payment"
          ? await recordPaymentEvidence({ clientId: params.clientId, session, transactionId: data.transactionId, next: data.next })
          : data.action === "legal_milestone"
            ? await recordLegalMilestone({ clientId: params.clientId, session, transactionId: data.transactionId, milestoneKey: data.milestoneKey, done: data.done, note: data.note })
            : data.action === "escalate"
              ? await escalateCase({ clientId: params.clientId, session, caseId: data.caseId, reason: data.reason })
              : data.action === "revoke"
                ? await revokeInvitation({ clientId: params.clientId, session, invitationId: data.invitationId })
                : await completeWorkItem({ clientId: params.clientId, session, workItemId: data.workItemId });
  if ("ok" in result && result.ok === false) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json(result);
}
