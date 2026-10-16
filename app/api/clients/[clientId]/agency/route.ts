import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { AGENCY_CAPABILITIES, PARTICIPANT_ROLES } from "@/lib/real-estate/agency-operations";
import { RE_AGENCY_OPERATIONS_DISABLED_MESSAGE, reAgencyOperationsEnabled } from "@/lib/real-estate/feature-flags";
import {
  addDealParticipant,
  agencyAttentionFeed,
  assignMilestone,
  commissionSetup,
  createCollaborationRequest,
  createCommission,
  createCommissionTemplate,
  endDealParticipant,
  executeHandover,
  grantCapability,
  linkTransactionDocument,
  listCommissions,
  listHandovers,
  openCommissionDispute,
  previewHandover,
  recordAllocationPayout,
  retryHandover,
  reviewCollaborationRequest,
  reviewCommissionDispute,
  reviewTransactionDocument,
  staffDirectory,
  transactionOperations,
  updateCommissionStatus,
  type AgencyActor,
} from "@/lib/real-estate/agency-service";

export const dynamic = "force-dynamic";

function actorFrom(session: { userId: string; role: string; clientId: string | null; user?: { name?: string | null } }): AgencyActor {
  return { id: session.userId, name: session.user?.name ?? "User", role: session.role, clientId: session.clientId };
}

type Failure = { ok: false; error: string; status: number; [key: string]: unknown };
type Outcome = { ok: true } | Failure;

function respond(result: Outcome, successStatus = 200) {
  if (result.ok) return NextResponse.json(result, { status: successStatus });
  const { ok: _ok, status, ...rest } = result as Failure; // eslint-disable-line @typescript-eslint/no-unused-vars
  return NextResponse.json(rest, { status });
}

const lineSchema = z.object({
  id: z.string().min(1),
  beneficiaryId: z.string().uuid(),
  role: z.string().min(1),
  mode: z.enum(["percent", "fixed"]),
  basisPoints: z.number().int().nullable().optional(),
  fixedCents: z.number().int().nullable().optional(),
  absorbsRemainder: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("template"),
    name: z.string().min(1).max(120),
    transactionType: z.enum(["sale", "rental"]),
    mode: z.enum(["percent", "fixed"]),
    basisPoints: z.number().int().nullable().optional(),
    fixedCents: z.number().int().nullable().optional(),
    currency: z.string().max(3).optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("commission"),
    transactionId: z.string().uuid(),
    basisCents: z.number().int().positive(),
    mode: z.enum(["percent", "fixed"]),
    basisPoints: z.number().int().nullable().optional(),
    fixedCents: z.number().int().nullable().optional(),
    currency: z.string().max(3).optional(),
    templateId: z.string().uuid().nullable().optional(),
    lines: z.array(lineSchema).min(1).max(12),
  }),
  z.object({
    action: z.literal("commission_status"),
    commissionId: z.string().uuid(),
    statusAction: z.enum(["earn", "invoice", "report_receipt", "verify_receipt", "approve_allocations", "cancel", "dispute"]),
    note: z.string().max(2000).nullable().optional(),
    amountCents: z.number().int().positive().nullable().optional(),
  }),
  z.object({
    action: z.literal("payout"),
    allocationId: z.string().uuid(),
    payoutCents: z.number().int().positive(),
    reference: z.string().max(200).nullable().optional(),
    verify: z.boolean(),
    payoutId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("dispute"),
    commissionId: z.string().uuid(),
    allocationId: z.string().uuid().nullable().optional(),
    reason: z.string().min(3).max(2000),
  }),
  z.object({
    action: z.literal("review_dispute"),
    disputeId: z.string().uuid(),
    decision: z.enum(["reviewing", "upheld", "adjusted", "resolved"]),
    note: z.string().max(2000).nullable().optional(),
    adjustedAmountCents: z.number().int().nonnegative().nullable().optional(),
  }),
  z.object({
    action: z.literal("participant"),
    transactionId: z.string().uuid().nullable().optional(),
    listingId: z.string().uuid().nullable().optional(),
    userId: z.string().uuid(),
    role: z.enum(PARTICIPANT_ROLES),
    responsibilities: z.string().max(1000).nullable().optional(),
  }),
  z.object({
    action: z.literal("end_participant"),
    participantId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("collaboration"),
    kind: z.enum(["listing_assistance", "buyer_introduction", "transaction_participation", "manager_intervention"]),
    listingId: z.string().uuid().nullable().optional(),
    searchId: z.string().uuid().nullable().optional(),
    transactionId: z.string().uuid().nullable().optional(),
    owningUserId: z.string().uuid().nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("review_collaboration"),
    requestId: z.string().uuid(),
    decision: z.enum(["approved", "declined"]),
  }),
  z.object({
    action: z.literal("handover"),
    fromUserId: z.string().uuid(),
    defaultReplacementId: z.string().uuid(),
    replacementByType: z.record(z.string(), z.string().uuid()).optional(),
    selectedKeys: z.array(z.string().max(120)).max(20000).nullable().optional(),
    expectedFingerprint: z.string().max(128).nullable().optional(),
    acceptChanges: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("handover_retry"),
    handoverId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("capability"),
    userId: z.string().uuid(),
    capability: z.enum(AGENCY_CAPABILITIES),
  }),
  z.object({
    action: z.literal("document"),
    transactionId: z.string().uuid(),
    documentId: z.string().uuid().nullable().optional(),
    storageKey: z.string().max(500).nullable().optional(),
    category: z.string().min(1).max(80),
    filename: z.string().max(200).nullable().optional(),
    visibility: z.enum(["participants", "managers", "finance"]).nullable().optional(),
    milestoneId: z.string().uuid().nullable().optional(),
    replacesDocumentLinkId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("review_document"),
    documentLinkId: z.string().uuid(),
    decision: z.enum(["under_review", "verified", "rejected", "replacement_requested"]),
    notes: z.string().max(2000).nullable().optional(),
    reason: z.string().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("assign_milestone"),
    milestoneId: z.string().uuid(),
    assignedToId: z.string().uuid().nullable().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    status: z.enum(["pending", "in_progress", "done", "skipped", "blocked"]).nullable().optional(),
  }),
]);

/** Transaction work and collaboration keep working when the commission and handover switch is off. */
const UNGATED_VIEWS = new Set(["attention", "staff", "transaction"]);
const GATED_ACTIONS = new Set([
  "template",
  "commission",
  "commission_status",
  "payout",
  "dispute",
  "review_dispute",
  "handover",
  "handover_retry",
]);

export async function GET(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const actor = actorFrom(g.session);
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const transactionId = url.searchParams.get("transactionId");
  if (!reAgencyOperationsEnabled() && !UNGATED_VIEWS.has(view ?? "")) {
    return NextResponse.json({ error: RE_AGENCY_OPERATIONS_DISABLED_MESSAGE, disabled: true }, { status: 503 });
  }
  if (view === "attention") return respond(await agencyAttentionFeed(params.clientId, actor));
  if (view === "handover" && url.searchParams.get("fromUserId")) {
    return respond(await previewHandover(params.clientId, actor, url.searchParams.get("fromUserId") as string));
  }
  if (view === "handovers") return respond(await listHandovers(params.clientId, actor));
  if (view === "staff") return respond(await staffDirectory(params.clientId, actor));
  if (view === "commission_setup" && transactionId) return respond(await commissionSetup(params.clientId, actor, transactionId));
  if (view === "transaction" && transactionId) return respond(await transactionOperations(params.clientId, actor, transactionId));
  const page = Number(url.searchParams.get("page") ?? "1");
  return respond(await listCommissions(params.clientId, actor, { page: Number.isFinite(page) ? page : 1 }));
}

export async function POST(req: Request, { params }: { params: { clientId: string } }) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const actor = actorFrom(g.session);
  const body = parsed.data;
  const clientId = params.clientId;
  if (!reAgencyOperationsEnabled() && GATED_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: RE_AGENCY_OPERATIONS_DISABLED_MESSAGE, disabled: true }, { status: 503 });
  }

  switch (body.action) {
    case "template":
      return respond(await createCommissionTemplate({ clientId, actor, ...body }), 201);
    case "commission":
      return respond(await createCommission({ clientId, actor, ...body }), 201);
    case "commission_status":
      return respond(
        await updateCommissionStatus({
          clientId,
          actor,
          commissionId: body.commissionId,
          action: body.statusAction,
          note: body.note,
          amountCents: body.amountCents,
        })
      );
    case "payout":
      return respond(await recordAllocationPayout({ clientId, actor, ...body }));
    case "dispute":
      return respond(await openCommissionDispute({ clientId, actor, ...body }), 201);
    case "review_dispute":
      return respond(await reviewCommissionDispute({ clientId, actor, ...body }));
    case "participant":
      return respond(await addDealParticipant({ clientId, actor, ...body }), 201);
    case "end_participant":
      return respond(await endDealParticipant({ clientId, actor, participantId: body.participantId }));
    case "collaboration":
      return respond(await createCollaborationRequest({ clientId, actor, ...body }), 201);
    case "review_collaboration":
      return respond(await reviewCollaborationRequest({ clientId, actor, ...body }));
    case "handover":
      return respond(await executeHandover({ clientId, actor, ...body }));
    case "handover_retry":
      return respond(await retryHandover({ clientId, actor, handoverId: body.handoverId }));
    case "capability":
      return respond(await grantCapability({ clientId, actor, userId: body.userId, capability: body.capability }));
    case "document":
      return respond(await linkTransactionDocument({ clientId, actor, ...body }), 201);
    case "review_document":
      return respond(await reviewTransactionDocument({ clientId, actor, ...body }));
    case "assign_milestone":
      return respond(await assignMilestone({ clientId, actor, ...body }));
  }
}
