import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { ACQUISITION_STAGES, PRICE_TYPES } from "@/lib/real-estate/acquisition-plan";
import {
  addPriceDiscussion,
  attachInspectionPhoto,
  prepareListingFromAcquisition,
  reassignAcquisition,
  recordOwnerContact,
  renewMandate,
  reviewMandate,
  revokeMandate,
  saveInspection,
  saveMandate,
  setAcquisitionOutcome,
  updateAcquisitionStage,
  type AcquisitionActor,
} from "@/lib/real-estate/acquisition-service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum([
    "stage",
    "outcome",
    "assign",
    "contact",
    "price",
    "inspection",
    "photo",
    "mandate",
    "review_mandate",
    "renew_mandate",
    "revoke_mandate",
    "prepare_listing",
  ]),
  verificationReference: z.string().max(200).nullable().optional(),
  terms: z.string().max(5000).nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().max(200).nullable().optional(),
  stage: z.enum(ACQUISITION_STAGES).optional(),
  status: z.enum(["on_hold", "nurturing", "not_interested", "lost", "active"]).optional(),
  reason: z.string().max(1000).nullable().optional(),
  agentId: z.string().uuid().optional(),
  note: z.string().max(5000).nullable().optional(),
  nextActionAt: z.string().nullable().optional(),
  interested: z.boolean().optional(),
  amount: z.number().optional(),
  currency: z.string().max(8).optional(),
  priceType: z.enum(PRICE_TYPES).optional(),
  documentId: z.string().uuid().nullable().optional(),
  inspectionId: z.string().uuid().nullable().optional(),
  inspection: z.record(z.unknown()).optional(),
  storageKey: z.string().max(500).nullable().optional(),
  caption: z.string().max(300).nullable().optional(),
  mandateId: z.string().uuid().nullable().optional(),
  mandateType: z.enum(["sole", "joint", "open"]).nullable().optional(),
  startDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  evidenceStatus: z.string().max(40).nullable().optional(),
  submit: z.boolean().optional(),
  decision: z.enum(["approved", "rejected"]).optional(),
  managerOverride: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { clientId: string; opportunityId: string } }
) {
  const g = await requireClientAccessFromRequest(req, params.clientId);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const actor: AcquisitionActor = {
    id: g.session.userId,
    name: g.session.user?.name ?? "Agent",
    role: g.session.role,
    clientId: g.session.clientId,
  };
  const body = parsed.data;
  const base = { clientId: params.clientId, opportunityId: params.opportunityId, actor };
  const result = await (async () => {
    switch (body.action) {
      case "stage":
        if (!body.stage) return { ok: false as const, error: "Stage is required.", status: 400 };
        return updateAcquisitionStage({ ...base, stage: body.stage });
      case "outcome":
        if (!body.status) return { ok: false as const, error: "Status is required.", status: 400 };
        return setAcquisitionOutcome({ ...base, status: body.status, reason: body.reason });
      case "assign":
        if (!body.agentId) return { ok: false as const, error: "Agent is required.", status: 400 };
        return reassignAcquisition({ ...base, agentId: body.agentId });
      case "contact":
        return recordOwnerContact({ ...base, note: body.note, nextActionAt: body.nextActionAt, interested: body.interested });
      case "price":
        if (body.amount == null || !body.priceType) return { ok: false as const, error: "Amount and price type are required.", status: 400 };
        return addPriceDiscussion({
          ...base,
          amount: body.amount,
          currency: body.currency,
          priceType: body.priceType,
          notes: body.note,
          documentId: body.documentId,
          verificationReference: body.verificationReference,
        });
      case "inspection":
        return saveInspection({ ...base, inspectionId: body.inspectionId, patch: body.inspection ?? {} });
      case "photo":
        if (!body.inspectionId) return { ok: false as const, error: "Inspection is required.", status: 400 };
        return attachInspectionPhoto({
          clientId: params.clientId,
          inspectionId: body.inspectionId,
          actor,
          documentId: body.documentId,
          storageKey: body.storageKey,
          caption: body.caption,
        });
      case "mandate":
        return saveMandate({
          ...base,
          mandateId: body.mandateId,
          mandateType: body.mandateType,
          startDate: body.startDate,
          expiryDate: body.expiryDate,
          documentId: body.documentId,
          evidenceStatus: body.evidenceStatus,
          submit: body.submit,
        });
      case "review_mandate":
        if (!body.mandateId || !body.decision) return { ok: false as const, error: "Mandate decision is required.", status: 400 };
        return reviewMandate({ clientId: params.clientId, mandateId: body.mandateId, actor, decision: body.decision, note: body.note });
      case "renew_mandate":
        if (!body.mandateId || !body.startDate || !body.expiryDate) {
          return { ok: false as const, error: "Choose the mandate and enter the renewal dates.", status: 400 };
        }
        return renewMandate({
          clientId: params.clientId,
          actor,
          mandateId: body.mandateId,
          startDate: body.startDate,
          expiryDate: body.expiryDate,
          mandateType: body.mandateType,
          terms: body.terms,
          documentId: body.documentId,
          responsibleAgentId: body.agentId,
          submit: body.submit,
        });
      case "revoke_mandate":
        if (!body.mandateId || !body.effectiveDate || !body.reason) {
          return { ok: false as const, error: "Enter the revocation reason and effective date.", status: 400 };
        }
        return revokeMandate({
          clientId: params.clientId,
          actor,
          mandateId: body.mandateId,
          reason: body.reason,
          effectiveDate: body.effectiveDate,
          reference: body.reference,
        });
      case "prepare_listing":
        return prepareListingFromAcquisition({ ...base, managerOverride: body.managerOverride });
      default:
        return { ok: false as const, error: "Unknown action.", status: 400 };
    }
  })();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
