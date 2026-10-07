import { createAdminClient } from "@/lib/supabase/admin";
import { createManualDocumentLink } from "@/lib/documents/linking/store";
import { canManageWorkProjects, type WorkProjectActor } from "@/lib/work-projects/access";
import { loadProjectCommercial } from "@/lib/work-projects/commercial-service";
import { quantityMissing } from "@/lib/work-projects/commercial-rules";
import { createProjectTask } from "@/lib/work-projects/field-service";
import {
  completionReadiness,
  equipmentNeedsSerial,
  installationAttention,
  OPERATIONAL_PROJECT_ROLES,
  schedulingWarnings,
  SOLAR_CHECKLIST_VERSION,
  warrantyStatus,
  type WarrantyLifecycle,
} from "@/lib/work-projects/installation-rules";
import { getWorkProject, updateWorkProjectStatus, type ServiceResult } from "@/lib/work-projects/service";

function fail(status: number, error: string): ServiceResult<never> {
  return { ok: false, status, error };
}

async function scoped(actor: WorkProjectActor, projectId: string) {
  if (!actor.clientId) return fail(403, "Missing company.");
  return getWorkProject(actor, projectId);
}

async function memberRole(clientId: string, projectId: string, userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("work_project_members")
    .select("project_role")
    .eq("client_id", clientId)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.project_role as string | undefined) ?? null;
}

async function canOperate(actor: WorkProjectActor, clientId: string, projectId: string) {
  if (canManageWorkProjects(actor, clientId)) return true;
  if (!actor.userId) return false;
  const role = await memberRole(clientId, projectId, actor.userId);
  return Boolean(role && (OPERATIONAL_PROJECT_ROLES as readonly string[]).includes(role));
}

async function writeEvent(opts: {
  clientId: string;
  projectId: string;
  actorId: string;
  eventType: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  await supabase.from("work_project_events").insert({
    client_id: opts.clientId,
    project_id: opts.projectId,
    event_type: opts.eventType,
    title: opts.title,
    description: opts.description ?? null,
    actor_user_id: opts.actorId,
    metadata: opts.metadata ?? {},
  });
}

type InstallationRow = {
  id: string;
  installation_number: string;
  status: string;
  installation_type: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  site_name: string | null;
  site_address: string | null;
  lead_installer_id: string | null;
  notes: string | null;
  completion_summary: string | null;
  readiness_exceptions: string[] | null;
  completed_at: string | null;
};

type EquipmentLine = {
  id: string;
  description: string;
  product_id: string | null;
  quantity_required: number;
  quantity_reserved: number;
  quantity_issued: number;
  quantity_installed: number;
  unit: string | null;
  track_inventory: boolean;
  requires_serial: boolean | null;
  cancelled: boolean;
};

export type InstallationSnapshot = {
  canOperate: boolean;
  canManage: boolean;
  showBalance: boolean;
  outstanding: number | null;
  currency: string;
  warnings: string[];
  attention: string[];
  completion: { canComplete: boolean; blockers: string[]; warnings: string[] };
  installation: InstallationRow | null;
  assignees: Array<{ user_id: string; project_role: string; name: string | null }>;
  checklist: { schema_version: number; data: Record<string, boolean>; status: string } | null;
  equipment: Array<EquipmentLine & { serials: Array<{ id: string; serial_number: string | null; manufacturer: string | null; model: string | null; status: string }> }>;
  qualityChecks: Array<{ id: string; outcome: string; notes: string | null; internal_notes: string | null; checked_at: string }>;
  commissioning: { id: string; status: string; outcome: string | null; data: Record<string, unknown>; customer_summary: string | null; internal_notes: string | null; commissioned_at: string | null } | null;
  handover: { id: string; status: string; customer_name: string | null; acknowledged: boolean; checklist: Record<string, boolean>; customer_notes: string | null; internal_notes: string | null; handover_at: string | null } | null;
  assets: Array<{ id: string; name: string; asset_type: string; status: string; quantity: number; serial_number: string | null; site_name: string | null; parent_asset_id: string | null; installed_at: string | null }>;
  warranties: Array<{ id: string; installed_asset_id: string; warranty_type: string; starts_at: string; expires_at: string | null; voided_at: string | null; status: WarrantyLifecycle }>;
};

function rpcFailed(data: { ok?: boolean; error?: string } | null, error: { message: string } | null) {
  if (error) return fail(400, "The stock change could not be saved.");
  if (!data?.ok) return fail(400, data?.error || "The stock change could not be saved.");
  return null;
}

export async function loadProjectInstallation(actor: WorkProjectActor, projectId: string): Promise<ServiceResult<InstallationSnapshot>> {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  const supabase = createAdminClient();
  const [installations, equipmentRes, commercial] = await Promise.all([
    supabase
      .from("work_project_installations")
      .select("*")
      .eq("client_id", project.client_id)
      .eq("project_id", projectId)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("work_project_equipment").select("*").eq("client_id", project.client_id).eq("project_id", projectId).eq("cancelled", false),
    loadProjectCommercial(actor, projectId),
  ]);
  const installation = (installations.data?.[0] ?? null) as InstallationRow | null;
  const equipment = ((equipmentRes.data ?? []) as EquipmentLine[]);
  let assignees: InstallationSnapshot["assignees"] = [];
  let checklist: InstallationSnapshot["checklist"] = null;
  let qualityChecks: InstallationSnapshot["qualityChecks"] = [];
  let commissioning: InstallationSnapshot["commissioning"] = null;
  let handover: InstallationSnapshot["handover"] = null;
  let assets: InstallationSnapshot["assets"] = [];
  let warranties: InstallationSnapshot["warranties"] = [];
  let serials: Array<{ id: string; project_equipment_id: string; serial_number: string | null; manufacturer: string | null; model: string | null; status: string }> = [];

  if (installation) {
    const [assigneeRes, checklistRes, qaRes, commRes, handRes, assetRes, unitRes] = await Promise.all([
      supabase.from("work_project_installation_assignees").select("user_id, project_role").eq("installation_id", installation.id),
      supabase.from("work_project_installation_checklists").select("schema_version, data, status").eq("installation_id", installation.id).eq("checklist_key", "SOLAR_INSTALLATION").maybeSingle(),
      supabase.from("work_project_quality_checks").select("id, outcome, notes, internal_notes, checked_at").eq("installation_id", installation.id).order("created_at", { ascending: false }),
      supabase.from("work_project_commissioning").select("id, status, outcome, data, customer_summary, internal_notes, commissioned_at").eq("installation_id", installation.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("work_project_handovers").select("id, status, customer_name, acknowledged, checklist, customer_notes, internal_notes, handover_at").eq("installation_id", installation.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("customer_installed_assets").select("id, name, asset_type, status, quantity, serial_number, site_name, parent_asset_id, installed_at").eq("installation_id", installation.id).order("created_at"),
      supabase.from("work_project_equipment_units").select("id, project_equipment_id, serial_number, manufacturer, model, status").eq("project_id", projectId).neq("status", "RETURNED"),
    ]);
    const userIds = (assigneeRes.data ?? []).map((row) => row.user_id as string);
    const names = userIds.length
      ? await supabase.from("users").select("id, name").in("id", userIds)
      : { data: [] };
    const nameById = new Map((names.data ?? []).map((row) => [row.id as string, (row.name as string | null) ?? null]));
    assignees = (assigneeRes.data ?? []).map((row) => ({
      user_id: row.user_id as string,
      project_role: row.project_role as string,
      name: nameById.get(row.user_id as string) ?? null,
    }));
    if (checklistRes.data) {
      checklist = {
        schema_version: Number(checklistRes.data.schema_version) || SOLAR_CHECKLIST_VERSION,
        data: (checklistRes.data.data ?? {}) as Record<string, boolean>,
        status: checklistRes.data.status as string,
      };
    }
    qualityChecks = (qaRes.data ?? []) as InstallationSnapshot["qualityChecks"];
    commissioning = (commRes.data?.[0] ?? null) as InstallationSnapshot["commissioning"];
    handover = (handRes.data?.[0] ?? null) as InstallationSnapshot["handover"];
    assets = (assetRes.data ?? []) as InstallationSnapshot["assets"];
    serials = (unitRes.data ?? []) as typeof serials;
    if (assets.length) {
      const warrantyRes = await supabase
        .from("installed_asset_warranties")
        .select("id, installed_asset_id, warranty_type, starts_at, expires_at, voided_at")
        .in("installed_asset_id", assets.map((asset) => asset.id));
      warranties = (warrantyRes.data ?? []).map((row) => ({
        ...(row as Omit<InstallationSnapshot["warranties"][number], "status">),
        status: warrantyStatus(row as { starts_at: string; expires_at: string | null; voided_at: string | null }),
      }));
    }
  }

  const gaps = equipment
    .filter((line) => line.track_inventory && quantityMissing(Number(line.quantity_required), Number(line.quantity_reserved) + Number(line.quantity_issued), true) > 0)
    .map((line) => ({
      description: line.description,
      missing: quantityMissing(Number(line.quantity_required), Number(line.quantity_reserved) + Number(line.quantity_issued), true),
    }));
  const commercialData = commercial.ok ? commercial.data : null;
  const warnings = schedulingWarnings({
    paymentReady: commercialData ? commercialData.gate.satisfied || !commercialData.paymentRequired : true,
    assessmentRequired: project.workflow_key === "SOLAR_INSTALLATION" && !project.inherited_sales_assessment_id,
    assessmentReady: commercialData?.assessmentCompleted ?? false,
    equipmentGaps: gaps,
  });
  const missingSerials = equipment
    .filter((line) => equipmentNeedsSerial(line.description, line.requires_serial) && Number(line.quantity_issued) > serials.filter((unit) => unit.project_equipment_id === line.id && unit.serial_number).length)
    .map((line) => line.description);
  const latestQa = qualityChecks[0]?.outcome ?? null;
  const attention = installation
    ? installationAttention({
        status: installation.status,
        scheduledStartAt: installation.scheduled_start_at,
        equipmentIssuedShort: equipment.some((line) => line.track_inventory && Number(line.quantity_issued) + Number(line.quantity_reserved) < Number(line.quantity_required) && Number(line.quantity_issued) < Number(line.quantity_required)),
        qaOutcome: latestQa,
        commissioningStatus: commissioning?.status ?? null,
        handoverStatus: handover?.status ?? null,
        projectStatus: project.status,
        missingSerials,
        outstanding: commercialData?.outstanding ?? null,
      })
    : [];
  const installedQuantity = equipment.reduce((sum, line) => sum + Number(line.quantity_installed || 0), 0);
  const completion = completionReadiness({
    workflow: project.workflow_key,
    projectStatus: project.status,
    installationStatus: installation?.status ?? null,
    qaOutcome: latestQa,
    commissioningStatus: commissioning?.status ?? null,
    handoverStatus: handover?.status ?? null,
    installedQuantity,
    assetCount: assets.length,
    outstanding: commercialData?.outstanding ?? null,
  });
  const showBalance = canManageWorkProjects(actor, project.client_id) || actor.role === "SALESPERSON";

  return {
    ok: true,
    data: {
      canOperate: await canOperate(actor, project.client_id, projectId),
      canManage: canManageWorkProjects(actor, project.client_id),
      showBalance,
      outstanding: showBalance ? commercialData?.outstanding ?? null : null,
      currency: commercialData?.currency ?? "USD",
      warnings,
      attention,
      completion,
      installation,
      assignees,
      checklist,
      equipment: equipment.map((line) => ({
        ...line,
        serials: serials.filter((unit) => unit.project_equipment_id === line.id),
      })),
      qualityChecks: qualityChecks.map((row) => ({
        ...row,
        internal_notes: canManageWorkProjects(actor, project.client_id) ? row.internal_notes : null,
      })),
      commissioning: commissioning
        ? { ...commissioning, internal_notes: canManageWorkProjects(actor, project.client_id) ? commissioning.internal_notes : null }
        : null,
      handover: handover
        ? { ...handover, internal_notes: canManageWorkProjects(actor, project.client_id) ? handover.internal_notes : null }
        : null,
      assets,
      warranties,
    },
  };
}

async function nextInstallationNumber(clientId: string) {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("work_project_installations")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  return `INS-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function createInstallation(
  actor: WorkProjectActor,
  projectId: string,
  installationType = "PRIMARY"
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot schedule installation on this project.");
  const supabase = createAdminClient();
  if (installationType === "PRIMARY") {
    const { data: existing } = await supabase
      .from("work_project_installations")
      .select("id")
      .eq("project_id", projectId)
      .eq("installation_type", "PRIMARY")
      .neq("status", "CANCELLED")
      .maybeSingle();
    if (existing) return loadProjectInstallation(actor, projectId);
  }
  const number = await nextInstallationNumber(project.client_id);
  const { error } = await supabase.from("work_project_installations").insert({
    client_id: project.client_id,
    project_id: projectId,
    installation_number: number,
    installation_type: installationType,
    status: "PLANNED",
    site_name: project.site_name,
    site_address: project.site_address,
    created_by: actor.userId,
  });
  if (error) return fail(400, "Installation could not be created.");
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "INSTALLATION_CREATED",
    title: "Installation created",
    metadata: { installation_number: number },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function scheduleInstallation(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; startAt: string; endAt?: string | null; assigneeIds: string[]; acknowledgeExceptions: boolean }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!canManageWorkProjects(actor, project.client_id)) return fail(403, "Only a manager can schedule installation.");
  const current = await loadProjectInstallation(actor, projectId);
  if (!current.ok) return current;
  if (current.data.warnings.length && !input.acknowledgeExceptions) {
    return fail(409, current.data.warnings.join(" "));
  }
  const supabase = createAdminClient();
  const { data: installation } = await supabase
    .from("work_project_installations")
    .select("id, status")
    .eq("id", input.installationId)
    .eq("client_id", project.client_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!installation) return fail(404, "Installation was not found.");
  const members = await supabase.from("work_project_members").select("user_id, project_role").eq("project_id", projectId).in("user_id", input.assigneeIds.length ? input.assigneeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (input.assigneeIds.length && (members.data ?? []).length !== input.assigneeIds.length) {
    return fail(400, "Assign installers from the project team.");
  }
  const { error } = await supabase
    .from("work_project_installations")
    .update({
      status: installation.status === "PLANNED" || installation.status === "SCHEDULED" ? "SCHEDULED" : installation.status,
      scheduled_start_at: input.startAt,
      scheduled_end_at: input.endAt || null,
      readiness_exceptions: input.acknowledgeExceptions ? current.data.warnings : [],
      lead_installer_id: input.assigneeIds[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.installationId);
  if (error) return fail(400, "Installation could not be scheduled.");
  if (input.assigneeIds.length) {
    await supabase.from("work_project_installation_assignees").delete().eq("installation_id", input.installationId);
    await supabase.from("work_project_installation_assignees").insert(
      input.assigneeIds.map((userId) => ({
        client_id: project.client_id,
        installation_id: input.installationId,
        user_id: userId,
        project_role: (members.data ?? []).find((row) => row.user_id === userId)?.project_role ?? "INSTALLER",
      }))
    );
  }
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "INSTALLATION_SCHEDULED",
    title: "Installation scheduled",
    metadata: { installation_id: input.installationId, exceptions: input.acknowledgeExceptions ? current.data.warnings : [] },
  });
  return loadProjectInstallation(actor, projectId);
}

async function loadOwnedInstallation(clientId: string, projectId: string, installationId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("work_project_installations")
    .select("*")
    .eq("id", installationId)
    .eq("client_id", clientId)
    .eq("project_id", projectId)
    .maybeSingle();
  return data as (InstallationRow & { client_id?: string }) | null;
}

export async function startInstallation(actor: WorkProjectActor, projectId: string, installationId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot start this installation.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, installationId);
  if (!installation || installation.status === "CANCELLED" || installation.status === "COMPLETED") return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  await supabase
    .from("work_project_installations")
    .update({
      status: "IN_PROGRESS",
      actual_start_at: installation.actual_start_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", installationId);
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "INSTALLATION_STARTED",
    title: "Installation started",
    metadata: { installation_id: installationId },
  });
  if (project.status !== "IN_PROGRESS" && project.status !== "COMPLETED" && project.status !== "CANCELLED") {
    await updateWorkProjectStatus(actor, projectId, "IN_PROGRESS");
  }
  return loadProjectInstallation(actor, projectId);
}

export async function pauseInstallation(actor: WorkProjectActor, projectId: string, installationId: string, paused: boolean) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot update this installation.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  await supabase
    .from("work_project_installations")
    .update({ status: paused ? "PAUSED" : "IN_PROGRESS", updated_at: new Date().toISOString() })
    .eq("id", installationId)
    .eq("client_id", project.client_id);
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: paused ? "INSTALLATION_PAUSED" : "INSTALLATION_STARTED",
    title: paused ? "Installation paused" : "Installation resumed",
    metadata: { installation_id: installationId },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function completePhysicalWork(actor: WorkProjectActor, projectId: string, installationId: string, summary: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot complete installation work.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  await supabase
    .from("work_project_installations")
    .update({
      status: "QA_PENDING",
      actual_end_at: installation.actual_end_at ?? new Date().toISOString(),
      completion_summary: summary.trim() || installation.completion_summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", installationId)
    .eq("client_id", project.client_id);
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "INSTALLATION_WORK_COMPLETED",
    title: "Installation work completed",
    metadata: { installation_id: installationId },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function saveInstallationChecklist(
  actor: WorkProjectActor,
  projectId: string,
  installationId: string,
  data: Record<string, boolean>,
  completed: boolean
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot update this checklist.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("work_project_installation_checklists").upsert(
    {
      client_id: project.client_id,
      installation_id: installationId,
      checklist_key: project.workflow_key === "SOLAR_INSTALLATION" ? "SOLAR_INSTALLATION" : "GENERAL_INSTALLATION",
      schema_version: SOLAR_CHECKLIST_VERSION,
      data,
      status: completed ? "COMPLETED" : "DRAFT",
      completed_by: completed ? actor.userId : null,
      completed_at: completed ? now : null,
      updated_at: now,
    },
    { onConflict: "installation_id,checklist_key" }
  );
  if (error) return fail(400, "Checklist could not be saved.");
  return loadProjectInstallation(actor, projectId);
}

export async function issueProjectEquipment(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; equipmentId: string; quantity: number; idempotencyKey: string }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot issue equipment.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("issue_work_project_equipment", {
    p_client_id: project.client_id,
    p_installation_id: input.installationId,
    p_equipment_id: input.equipmentId,
    p_quantity: input.quantity,
    p_actor_id: actor.userId,
    p_idempotency_key: input.idempotencyKey,
  });
  const failed = rpcFailed(data as { ok?: boolean; error?: string } | null, error);
  if (failed) return failed;
  return loadProjectInstallation(actor, projectId);
}

export async function returnProjectEquipment(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; equipmentId: string; locationId: string; quantity: number; reason: string; idempotencyKey: string; unitId?: string | null }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot return equipment.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("return_work_project_equipment", {
    p_client_id: project.client_id,
    p_installation_id: input.installationId,
    p_equipment_id: input.equipmentId,
    p_location_id: input.locationId,
    p_quantity: input.quantity,
    p_actor_id: actor.userId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
    p_unit_id: input.unitId ?? null,
  });
  const failed = rpcFailed(data as { ok?: boolean; error?: string } | null, error);
  if (failed) return failed;
  return loadProjectInstallation(actor, projectId);
}

export async function recordEquipmentSerial(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; equipmentId: string; serialNumber: string; manufacturer?: string | null; model?: string | null }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot record serial numbers.");
  const serial = input.serialNumber.trim();
  if (!serial) return fail(400, "Enter a serial number.");
  const supabase = createAdminClient();
  const { data: line } = await supabase
    .from("work_project_equipment")
    .select("id, quantity_issued")
    .eq("id", input.equipmentId)
    .eq("client_id", project.client_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!line) return fail(404, "Equipment line was not found.");
  const { count } = await supabase
    .from("work_project_equipment_units")
    .select("id", { count: "exact", head: true })
    .eq("project_equipment_id", input.equipmentId)
    .in("status", ["RECORDED", "INSTALLED"]);
  if ((count ?? 0) >= Number(line.quantity_issued || 0)) return fail(400, "Issue the equipment before recording another serial.");
  const { error } = await supabase.from("work_project_equipment_units").insert({
    client_id: project.client_id,
    project_id: projectId,
    installation_id: input.installationId,
    project_equipment_id: input.equipmentId,
    serial_number: serial,
    manufacturer: input.manufacturer?.trim() || null,
    model: input.model?.trim() || null,
    status: "RECORDED",
  });
  if (error) return fail(409, "That serial number is already active in this company.");
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "SERIAL_RECORDED",
    title: "Serial number recorded",
    metadata: { equipment_id: input.equipmentId, installation_id: input.installationId },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function setInstalledQuantity(
  actor: WorkProjectActor,
  projectId: string,
  input: { equipmentId: string; quantity: number; unitId?: string | null }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot confirm installed equipment.");
  const supabase = createAdminClient();
  const { data: line } = await supabase
    .from("work_project_equipment")
    .select("id, quantity_issued, quantity_installed")
    .eq("id", input.equipmentId)
    .eq("client_id", project.client_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!line) return fail(404, "Equipment line was not found.");
  if (input.unitId) {
    const { data: unit } = await supabase
      .from("work_project_equipment_units")
      .select("id, status")
      .eq("id", input.unitId)
      .eq("client_id", project.client_id)
      .eq("project_equipment_id", input.equipmentId)
      .maybeSingle();
    if (!unit || unit.status === "RETURNED") return fail(404, "Equipment unit was not found.");
    await supabase
      .from("work_project_equipment_units")
      .update({ status: "INSTALLED", installed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", input.unitId);
    const { count } = await supabase
      .from("work_project_equipment_units")
      .select("id", { count: "exact", head: true })
      .eq("project_equipment_id", input.equipmentId)
      .eq("status", "INSTALLED");
    await supabase
      .from("work_project_equipment")
      .update({ quantity_installed: count ?? 0, updated_at: new Date().toISOString() })
      .eq("id", input.equipmentId);
    return loadProjectInstallation(actor, projectId);
  }
  if (input.quantity < 0 || input.quantity > Number(line.quantity_issued)) {
    return fail(400, "Installed quantity cannot exceed issued quantity.");
  }
  await supabase
    .from("work_project_equipment")
    .update({ quantity_installed: input.quantity, updated_at: new Date().toISOString() })
    .eq("id", input.equipmentId);
  return loadProjectInstallation(actor, projectId);
}

export async function recordQualityCheck(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; outcome: string; data: Record<string, boolean>; notes?: string | null; internalNotes?: string | null }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!canManageWorkProjects(actor, project.client_id)) return fail(403, "Only a manager can record quality check.");
  if (!["PASS", "PASS_WITH_NOTES", "REQUIRES_REWORK"].includes(input.outcome)) return fail(400, "Choose a quality outcome.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, input.installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("work_project_quality_checks").insert({
    client_id: project.client_id,
    project_id: projectId,
    installation_id: input.installationId,
    outcome: input.outcome,
    schema_version: 1,
    data: input.data,
    notes: input.notes?.trim() || null,
    internal_notes: input.internalNotes?.trim() || null,
    checked_by: actor.userId,
  });
  if (error) return fail(400, "Quality check could not be saved.");
  await supabase
    .from("work_project_installations")
    .update({
      status: input.outcome === "REQUIRES_REWORK" ? "IN_PROGRESS" : "COMMISSIONING_PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.installationId);
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: input.outcome === "REQUIRES_REWORK" ? "QA_FAILED" : "QA_COMPLETED",
    title: input.outcome === "REQUIRES_REWORK" ? "Quality check needs rework" : "Quality check completed",
    description: input.notes?.trim() || null,
    metadata: { installation_id: input.installationId, outcome: input.outcome },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function createReworkTask(actor: WorkProjectActor, projectId: string, installationId: string, title: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const installation = await loadOwnedInstallation(loaded.data.project.client_id, projectId, installationId);
  if (!installation) return fail(404, "Installation was not found.");
  return createProjectTask(actor, projectId, {
    title: title.trim() || "Installation rework",
    description: "Created from a quality check that requires rework.",
    taskType: "GENERAL",
    priority: "HIGH",
  });
}

export async function completeCommissioning(
  actor: WorkProjectActor,
  projectId: string,
  input: {
    installationId: string;
    outcome: "PASSED" | "PASSED_WITH_NOTES" | "FAILED";
    data: Record<string, unknown>;
    customerSummary?: string | null;
    internalNotes?: string | null;
    idempotencyKey: string;
  }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!canManageWorkProjects(actor, project.client_id)) return fail(403, "Only a manager can complete commissioning.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, input.installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("complete_work_project_commissioning", {
    p_client_id: project.client_id,
    p_installation_id: input.installationId,
    p_actor_id: actor.userId,
    p_outcome: input.outcome,
    p_data: input.data,
    p_customer_summary: input.customerSummary ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  const failed = rpcFailed(data as { ok?: boolean; error?: string } | null, error);
  if (failed) return failed;
  return loadProjectInstallation(actor, projectId);
}

export async function completeHandover(
  actor: WorkProjectActor,
  projectId: string,
  input: {
    installationId: string;
    customerName: string;
    acknowledged: boolean;
    checklist: Record<string, boolean>;
    trainingCompleted: boolean;
    documentsProvided: boolean;
    customerNotes?: string | null;
    internalNotes?: string | null;
  }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!canManageWorkProjects(actor, project.client_id)) return fail(403, "Only a manager can complete handover.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, input.installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const supabase = createAdminClient();
  const { data: commissioning } = await supabase
    .from("work_project_commissioning")
    .select("status")
    .eq("installation_id", input.installationId)
    .eq("status", "COMPLETED")
    .maybeSingle();
  if (!commissioning && project.workflow_key === "SOLAR_INSTALLATION") {
    return fail(400, "Complete commissioning before handover.");
  }
  if (!input.acknowledged || !input.customerName.trim()) return fail(400, "Record the customer name and acknowledgement.");
  const { data: existing } = await supabase
    .from("work_project_handovers")
    .select("id")
    .eq("installation_id", input.installationId)
    .eq("status", "COMPLETED")
    .maybeSingle();
  if (existing) return loadProjectInstallation(actor, projectId);
  const now = new Date().toISOString();
  const { error } = await supabase.from("work_project_handovers").insert({
    client_id: project.client_id,
    project_id: projectId,
    installation_id: input.installationId,
    status: "COMPLETED",
    handover_at: now,
    handed_over_by: actor.userId,
    customer_name: input.customerName.trim(),
    acknowledged: true,
    training_completed: input.trainingCompleted,
    documents_provided: input.documentsProvided,
    checklist: input.checklist,
    schema_version: 1,
    customer_notes: input.customerNotes?.trim() || null,
    internal_notes: input.internalNotes?.trim() || null,
  });
  if (error) return fail(400, "Handover could not be saved.");
  await supabase
    .from("work_project_installations")
    .update({ status: "COMPLETED", completed_at: now, updated_at: now })
    .eq("id", input.installationId)
    .eq("client_id", project.client_id);
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "HANDOVER_COMPLETED",
    title: "Handover completed",
    metadata: { installation_id: input.installationId },
  });
  return loadProjectInstallation(actor, projectId);
}

export async function linkInstallationEvidence(
  actor: WorkProjectActor,
  projectId: string,
  input: { installationId: string; documentId: string; category: string; label: string }
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  if (!(await canOperate(actor, project.client_id, projectId))) return fail(403, "You cannot add installation evidence.");
  const installation = await loadOwnedInstallation(project.client_id, projectId, input.installationId);
  if (!installation) return fail(404, "Installation was not found.");
  const link = await createManualDocumentLink({
    clientId: project.client_id,
    documentId: input.documentId,
    actorUserId: actor.userId,
    candidate: {
      entityType: "WORK_PROJECT_INSTALLATION",
      entityId: input.installationId,
      linkType: "MANUAL",
      confidence: "HIGH",
      matchReason: input.category,
      label: input.label,
      metadata: { category: input.category },
    },
  });
  if (!link) return fail(400, "Evidence could not be linked.");
  return { ok: true as const, data: { linked: true } };
}

export async function updateInstalledAssetStatus(
  actor: WorkProjectActor,
  projectId: string,
  assetId: string,
  status: "REMOVED" | "REPLACED" | "FAILED" | "DECOMMISSIONED" | "ACTIVE"
) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can update installed assets.");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_installed_assets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .eq("client_id", loaded.data.project.client_id)
    .eq("work_project_id", projectId)
    .select("id")
    .maybeSingle();
  if (!data) return fail(404, "Installed asset was not found.");
  return loadProjectInstallation(actor, projectId);
}

export async function projectCompletionGate(actor: WorkProjectActor, projectId: string) {
  const snapshot = await loadProjectInstallation(actor, projectId);
  if (!snapshot.ok) return snapshot;
  if (!snapshot.data.completion.canComplete) {
    return fail(400, snapshot.data.completion.blockers[0] || "Project is not ready to complete.");
  }
  return snapshot;
}

export async function loadInstallationOperations(clientId: string) {
  const supabase = createAdminClient();
  const { data: installations } = await supabase
    .from("work_project_installations")
    .select("id, project_id, status, scheduled_start_at")
    .eq("client_id", clientId)
    .limit(500);
  const rows = installations ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const installationIds = rows.map((row) => row.id as string);
  const projectIds = [...new Set(rows.map((row) => row.project_id as string))];
  const [qa, commissioning, projects] = await Promise.all([
    installationIds.length
      ? supabase.from("work_project_quality_checks").select("installation_id, outcome, created_at").in("installation_id", installationIds)
      : Promise.resolve({ data: [] }),
    installationIds.length
      ? supabase.from("work_project_commissioning").select("installation_id, status, created_at").in("installation_id", installationIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? supabase.from("work_projects").select("id, status").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const latestQa = new Map<string, string>();
  const qaRows = [...(qa.data ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const row of qaRows) {
    if (!latestQa.has(row.installation_id as string)) latestQa.set(row.installation_id as string, row.outcome as string);
  }
  const latestCommission = new Map<string, string>();
  const commissionRows = [...(commissioning.data ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  for (const row of commissionRows) {
    if (!latestCommission.has(row.installation_id as string)) latestCommission.set(row.installation_id as string, row.status as string);
  }
  const projectStatus = new Map((projects.data ?? []).map((row) => [row.id as string, row.status as string]));
  return {
    installationsToday: rows.filter((row) => String(row.scheduled_start_at ?? "").slice(0, 10) === today && ["SCHEDULED", "IN_PROGRESS"].includes(row.status as string)).length,
    inProgress: rows.filter((row) => ["IN_PROGRESS", "PAUSED"].includes(row.status as string)).length,
    qaPending: rows.filter((row) => row.status === "QA_PENDING").length,
    commissioningPending: rows.filter((row) => row.status === "COMMISSIONING_PENDING").length,
    handoverPending: rows.filter((row) => row.status === "HANDOVER_PENDING").length,
    readyToComplete: rows.filter((row) => row.status === "COMPLETED" && projectStatus.get(row.project_id as string) !== "COMPLETED").length,
    blocked: rows.filter((row) => latestQa.get(row.id as string) === "REQUIRES_REWORK" || latestCommission.get(row.id as string) === "FAILED").length,
  };
}

export function emptyInstallationSnapshot(): InstallationSnapshot {
  return {
    canOperate: false,
    canManage: false,
    showBalance: false,
    outstanding: null,
    currency: "USD",
    warnings: [],
    attention: [],
    completion: { canComplete: false, blockers: [], warnings: [] },
    installation: null,
    assignees: [],
    checklist: null,
    equipment: [],
    qualityChecks: [],
    commissioning: null,
    handover: null,
    assets: [],
    warranties: [],
  };
}

export async function listContactAssets(clientId: string, contactId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("customer_installed_assets")
    .select("id, name, asset_type, status, quantity, unit, serial_number, site_name, site_address, installed_at, parent_asset_id")
    .eq("client_id", clientId)
    .eq("contact_id", contactId)
    .eq("customer_visible", true)
    .order("installed_at", { ascending: false })
    .limit(40);
  return data ?? [];
}
