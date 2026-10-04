import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeCommissioning,
  completeHandover,
  completePhysicalWork,
  createInstallation,
  createReworkTask,
  issueProjectEquipment,
  linkInstallationEvidence,
  pauseInstallation,
  recordEquipmentSerial,
  recordQualityCheck,
  returnProjectEquipment,
  saveInstallationChecklist,
  scheduleInstallation,
  setInstalledQuantity,
  startInstallation,
  updateInstalledAssetStatus,
} from "@/lib/work-projects/installation-service";
import { INSTALLATION_PHOTO_CATEGORIES, INSTALLATION_TYPES } from "@/lib/work-projects/installation-rules";
import { workProjectActor, workProjectError } from "@/lib/work-projects/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum([
    "create",
    "schedule",
    "start",
    "pause",
    "resume",
    "complete_work",
    "checklist",
    "issue",
    "return",
    "serial",
    "installed",
    "qa",
    "rework",
    "commissioning",
    "handover",
    "evidence",
    "asset_status",
  ]),
  installationId: z.string().uuid().optional(),
  installationType: z.enum(INSTALLATION_TYPES as unknown as [string, ...string[]]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  acknowledgeExceptions: z.boolean().optional(),
  summary: z.string().max(2000).optional(),
  checklist: z.record(z.boolean()).optional(),
  completed: z.boolean().optional(),
  equipmentId: z.string().uuid().optional(),
  quantity: z.number().nonnegative().optional(),
  idempotencyKey: z.string().max(80).optional(),
  locationId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
  unitId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().max(120).optional(),
  manufacturer: z.string().max(120).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  outcome: z.string().max(40).optional(),
  notes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  data: z.record(z.unknown()).optional(),
  customerSummary: z.string().max(2000).nullable().optional(),
  customerName: z.string().max(160).optional(),
  acknowledged: z.boolean().optional(),
  trainingCompleted: z.boolean().optional(),
  documentsProvided: z.boolean().optional(),
  customerNotes: z.string().max(2000).nullable().optional(),
  documentId: z.string().uuid().optional(),
  category: z.enum(INSTALLATION_PHOTO_CATEGORIES as unknown as [string, ...string[]]).optional(),
  label: z.string().max(160).optional(),
  assetId: z.string().uuid().optional(),
  assetStatus: z.enum(["ACTIVE", "REMOVED", "REPLACED", "FAILED", "DECOMMISSIONED"]).optional(),
  title: z.string().max(160).optional(),
});

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  const actor = await workProjectActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Check the installation details." }, { status: 400 });
  const input = body.data;
  const installationId = input.installationId;

  if (input.action === "create") {
    const result = await createInstallation(actor, params.projectId, input.installationType);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (!installationId) {
    return NextResponse.json({ error: "Choose an installation." }, { status: 400 });
  }
  if (input.action === "schedule") {
    if (!input.startAt) return NextResponse.json({ error: "Choose a start time." }, { status: 400 });
    const result = await scheduleInstallation(actor, params.projectId, {
      installationId: installationId!,
      startAt: input.startAt,
      endAt: input.endAt,
      assigneeIds: input.assigneeIds ?? [],
      acknowledgeExceptions: input.acknowledgeExceptions ?? false,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "start") {
    const result = await startInstallation(actor, params.projectId, installationId!);
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "pause" || input.action === "resume") {
    const result = await pauseInstallation(actor, params.projectId, installationId!, input.action === "pause");
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "complete_work") {
    const result = await completePhysicalWork(actor, params.projectId, installationId!, input.summary ?? "");
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "checklist") {
    const result = await saveInstallationChecklist(actor, params.projectId, installationId!, input.checklist ?? {}, Boolean(input.completed));
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "issue") {
    if (!input.equipmentId || !input.quantity || !input.idempotencyKey) {
      return NextResponse.json({ error: "Choose equipment and a quantity." }, { status: 400 });
    }
    const result = await issueProjectEquipment(actor, params.projectId, {
      installationId: installationId!,
      equipmentId: input.equipmentId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "return") {
    if (!input.equipmentId || !input.quantity || !input.locationId || !input.reason || !input.idempotencyKey) {
      return NextResponse.json({ error: "Choose a location, quantity, and reason." }, { status: 400 });
    }
    const result = await returnProjectEquipment(actor, params.projectId, {
      installationId: installationId!,
      equipmentId: input.equipmentId,
      locationId: input.locationId,
      quantity: input.quantity,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      unitId: input.unitId,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "serial") {
    if (!input.equipmentId || !input.serialNumber) return NextResponse.json({ error: "Enter a serial number." }, { status: 400 });
    const result = await recordEquipmentSerial(actor, params.projectId, {
      installationId: installationId!,
      equipmentId: input.equipmentId,
      serialNumber: input.serialNumber,
      manufacturer: input.manufacturer,
      model: input.model,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "installed") {
    if (!input.equipmentId || input.quantity == null) return NextResponse.json({ error: "Enter the installed quantity." }, { status: 400 });
    const result = await setInstalledQuantity(actor, params.projectId, {
      equipmentId: input.equipmentId,
      quantity: input.quantity,
      unitId: input.unitId,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "qa") {
    if (!input.outcome) return NextResponse.json({ error: "Choose a quality outcome." }, { status: 400 });
    const result = await recordQualityCheck(actor, params.projectId, {
      installationId: installationId!,
      outcome: input.outcome,
      data: (input.checklist ?? {}) as Record<string, boolean>,
      notes: input.notes,
      internalNotes: input.internalNotes,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "rework") {
    const result = await createReworkTask(actor, params.projectId, installationId!, input.title || "Installation rework");
    if (!result.ok) return workProjectError(result);
    return NextResponse.json({ ok: true });
  }
  if (input.action === "commissioning") {
    if (!input.idempotencyKey || !input.outcome) return NextResponse.json({ error: "Choose a commissioning outcome." }, { status: 400 });
    if (input.outcome !== "PASSED" && input.outcome !== "PASSED_WITH_NOTES" && input.outcome !== "FAILED") {
      return NextResponse.json({ error: "Choose a commissioning outcome." }, { status: 400 });
    }
    const result = await completeCommissioning(actor, params.projectId, {
      installationId: installationId!,
      outcome: input.outcome,
      data: input.data ?? {},
      customerSummary: input.customerSummary,
      internalNotes: input.internalNotes,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "handover") {
    const result = await completeHandover(actor, params.projectId, {
      installationId: installationId!,
      customerName: input.customerName || "",
      acknowledged: Boolean(input.acknowledged),
      checklist: input.checklist ?? {},
      trainingCompleted: Boolean(input.trainingCompleted),
      documentsProvided: Boolean(input.documentsProvided),
      customerNotes: input.customerNotes,
      internalNotes: input.internalNotes,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  if (input.action === "evidence") {
    if (!input.documentId || !input.category) return NextResponse.json({ error: "Choose a photo and category." }, { status: 400 });
    const result = await linkInstallationEvidence(actor, params.projectId, {
      installationId: installationId!,
      documentId: input.documentId,
      category: input.category,
      label: input.label || input.category,
    });
    if (!result.ok) return workProjectError(result);
    return NextResponse.json(result.data);
  }
  const result = await updateInstalledAssetStatus(
    actor,
    params.projectId,
    input.assetId || "",
    input.assetStatus || "REMOVED"
  );
  if (!result.ok) return workProjectError(result);
  return NextResponse.json(result.data);
}
