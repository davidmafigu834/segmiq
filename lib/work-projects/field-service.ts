import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstate } from "@/lib/terminology";
import {
  canManageWorkProjects,
  canReadWorkProject,
  type WorkProjectActor,
} from "@/lib/work-projects/access";
import {
  isAssignableProjectRole,
  isWorkProjectPriority,
  isWorkProjectTaskStatus,
  isWorkProjectTaskType,
  isWorkProjectVisitType,
  VISIT_CANCEL_REASONS,
  workProjectMemberRoleLabel,
  workProjectVisitTypeLabel,
  type WorkProjectTaskStatus,
} from "@/lib/work-projects/constants";
import {
  canMemberUpdateTask,
  closedVisit,
  emptySolarAssessment,
  fieldAttention,
  isTaskOverdue,
  isVisitOverdue,
  parseSolarAssessment,
  solarAssessmentCompletionError,
  solarLoadSummary,
  solarOutcomeLabel,
  taskEventForStatus,
  type SolarAssessmentData,
} from "@/lib/work-projects/field-rules";
import { getWorkProject, type ServiceResult } from "@/lib/work-projects/service";
import { sendWhatsAppTextToLead } from "@/lib/whatsapp/send-text";

function fail(status: number, error: string): ServiceResult<never> {
  return { ok: false, status, error };
}

async function companyUser(clientId: string, userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  if (!["CLIENT_MANAGER", "SALESPERSON", "SUPER_ADMIN"].includes(data.role as string)) return null;
  return data as { id: string; name: string | null; role: string };
}

async function assertTrades(clientId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("business_type").eq("id", clientId).maybeSingle();
  if (!data || isRealEstate(data.business_type as string | null)) return fail(404, "Projects are available for trades companies.");
  return { ok: true as const, data: null };
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

async function notifyUsers(userIds: string[], message: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const supabase = createAdminClient();
  await supabase.from("notifications").insert(
    unique.map((userId) => ({
      user_id: userId,
      type: "WORK_PROJECT_ALERT",
      message,
      read: false,
    }))
  );
}

async function projectScope(actor: WorkProjectActor, projectId: string) {
  if (!actor.clientId) return fail(403, "Missing company.");
  const trades = await assertTrades(actor.clientId);
  if (!trades.ok) return trades;
  return getWorkProject(actor, projectId);
}

export async function addProjectMember(
  actor: WorkProjectActor,
  projectId: string,
  userId: string,
  role: string
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) {
    return fail(403, "Only a manager can change the project team.");
  }
  if (!isAssignableProjectRole(role)) return fail(400, "Choose a project role.");
  const user = await companyUser(loaded.data.project.client_id, userId);
  if (!user) return fail(400, "That person is not a user in this company.");
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("work_project_members")
    .select("id, project_role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    if (existing.project_role === role) return { ok: true as const, data: { id: existing.id as string, changed: false } };
    const { error } = await supabase
      .from("work_project_members")
      .update({ project_role: role })
      .eq("id", existing.id)
      .eq("client_id", loaded.data.project.client_id);
    if (error) return fail(500, "Could not update the project role.");
    await writeEvent({
      clientId: loaded.data.project.client_id,
      projectId,
      actorId: actor.userId,
      eventType: "MEMBER_ROLE_CHANGED",
      title: "Team role changed",
      description: `${user.name || "Team member"} is now ${workProjectMemberRoleLabel(role)}.`,
      metadata: { user_id: userId, from_role: existing.project_role, to_role: role },
    });
    return { ok: true as const, data: { id: existing.id as string, changed: true } };
  }
  const { data, error } = await supabase
    .from("work_project_members")
    .insert({
      client_id: loaded.data.project.client_id,
      project_id: projectId,
      user_id: userId,
      project_role: role,
    })
    .select("id")
    .single();
  if (error || !data) return fail(500, "Could not add the project member.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "MEMBER_ADDED",
    title: "Team member added",
    description: `${user.name || "Team member"} joined as ${workProjectMemberRoleLabel(role)}.`,
    metadata: { user_id: userId, role },
  });
  await notifyUsers([userId], `You were added to ${loaded.data.project.project_number} as ${workProjectMemberRoleLabel(role)}.`);
  return { ok: true as const, data: { id: data.id as string, changed: true } };
}

export async function removeProjectMember(actor: WorkProjectActor, projectId: string, userId: string) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) {
    return fail(403, "Only a manager can change the project team.");
  }
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("work_project_members")
    .select("id, project_role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!existing) return fail(404, "That person is not on this project.");
  const { error } = await supabase.from("work_project_members").delete().eq("id", existing.id);
  if (error) return fail(500, "Could not remove the project member.");
  if (loaded.data.project.project_owner_id === userId) {
    await supabase
      .from("work_projects")
      .update({ project_owner_id: null, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("client_id", loaded.data.project.client_id);
  }
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "MEMBER_REMOVED",
    title: "Team member removed",
    metadata: { user_id: userId, role: existing.project_role },
  });
  return { ok: true as const, data: { removed: true } };
}

export async function createProjectTask(
  actor: WorkProjectActor,
  projectId: string,
  input: {
    title: string;
    description?: string | null;
    taskType?: string | null;
    priority?: string | null;
    assignedToId?: string | null;
    dueAt?: string | null;
  }
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) {
    return fail(403, "Only a manager can create project tasks.");
  }
  const title = input.title.trim();
  if (!title) return fail(400, "Enter a task title.");
  const taskType = input.taskType && isWorkProjectTaskType(input.taskType) ? input.taskType : "GENERAL";
  const priority = input.priority && isWorkProjectPriority(input.priority) ? input.priority : "NORMAL";
  if (input.assignedToId) {
    const user = await companyUser(loaded.data.project.client_id, input.assignedToId);
    if (!user) return fail(400, "Assignee must belong to this company.");
    if (!loaded.data.scope.member_user_ids.includes(input.assignedToId) && loaded.data.project.project_owner_id !== input.assignedToId) {
      return fail(400, "Assign the task to someone on this project.");
    }
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_project_tasks")
    .insert({
      client_id: loaded.data.project.client_id,
      project_id: projectId,
      title,
      description: input.description?.trim() || null,
      task_type: taskType,
      priority,
      assigned_to_id: input.assignedToId || null,
      due_at: input.dueAt || null,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data) return fail(500, "Could not create the task.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "TASK_CREATED",
    title: "Task created",
    description: title,
    metadata: { task_id: data.id },
  });
  if (input.assignedToId) {
    await writeEvent({
      clientId: loaded.data.project.client_id,
      projectId,
      actorId: actor.userId,
      eventType: "TASK_ASSIGNED",
      title: "Task assigned",
      description: title,
      metadata: { task_id: data.id, assigned_to_id: input.assignedToId },
    });
    await notifyUsers([input.assignedToId], `Task assigned on ${loaded.data.project.project_number}: ${title}`);
  }
  return { ok: true as const, data: { id: data.id as string } };
}

export async function updateProjectTask(
  actor: WorkProjectActor,
  projectId: string,
  taskId: string,
  patch: { status?: string | null; assignedToId?: string | null; title?: string | null; dueAt?: string | null }
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  const supabase = createAdminClient();
  const { data: task } = await supabase
    .from("work_project_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("project_id", projectId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!task) return fail(404, "Task not found.");
  const isManager = canManageWorkProjects(actor, loaded.data.project.client_id);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) {
    if (!isWorkProjectTaskStatus(patch.status)) return fail(400, "Unknown task status.");
    if (patch.status === task.status) {
      return { ok: true as const, data: { id: taskId, unchanged: true } };
    }
    if (!canMemberUpdateTask({
      isManager,
      actorUserId: actor.userId,
      assignedToId: task.assigned_to_id as string | null,
      nextStatus: patch.status,
    })) {
      return fail(403, "You cannot update this task.");
    }
    updates.status = patch.status;
    if (patch.status === "IN_PROGRESS" && !task.started_at) updates.started_at = new Date().toISOString();
    if (patch.status === "COMPLETED" && !task.completed_at) updates.completed_at = new Date().toISOString();
  } else if (!isManager) {
    return fail(403, "Only a manager can edit this task.");
  }
  if (patch.assignedToId !== undefined && patch.assignedToId !== task.assigned_to_id) {
    if (!isManager) return fail(403, "Only a manager can reassign a task.");
    if (patch.assignedToId) {
      const user = await companyUser(loaded.data.project.client_id, patch.assignedToId);
      if (!user) return fail(400, "Assignee must belong to this company.");
      if (!loaded.data.scope.member_user_ids.includes(patch.assignedToId) && loaded.data.project.project_owner_id !== patch.assignedToId) {
        return fail(400, "Assign the task to someone on this project.");
      }
    }
    updates.assigned_to_id = patch.assignedToId;
  }
  if (patch.title != null && isManager) {
    const title = patch.title.trim();
    if (!title) return fail(400, "Enter a task title.");
    updates.title = title;
  }
  if (patch.dueAt !== undefined && isManager) updates.due_at = patch.dueAt;
  const { error } = await supabase.from("work_project_tasks").update(updates).eq("id", taskId);
  if (error) return fail(500, "Could not update the task.");
  if (patch.status && patch.status !== task.status) {
    const eventType = taskEventForStatus(patch.status as WorkProjectTaskStatus);
    if (eventType) {
      await writeEvent({
        clientId: loaded.data.project.client_id,
        projectId,
        actorId: actor.userId,
        eventType,
        title: eventType.replaceAll("_", " ").toLowerCase(),
        description: (updates.title as string) || (task.title as string),
        metadata: { task_id: taskId, status: patch.status },
      });
    }
  }
  if (patch.assignedToId && patch.assignedToId !== task.assigned_to_id) {
    await writeEvent({
      clientId: loaded.data.project.client_id,
      projectId,
      actorId: actor.userId,
      eventType: "TASK_ASSIGNED",
      title: "Task assigned",
      description: task.title as string,
      metadata: { task_id: taskId, assigned_to_id: patch.assignedToId },
    });
    await notifyUsers([patch.assignedToId], `Task assigned on ${loaded.data.project.project_number}: ${task.title}`);
  }
  return { ok: true as const, data: { id: taskId, unchanged: false } };
}

export async function scheduleProjectVisit(
  actor: WorkProjectActor,
  projectId: string,
  input: {
    visitType: string;
    startAt: string;
    durationMinutes: number;
    assigneeIds: string[];
    siteAddress?: string | null;
    instructions?: string | null;
    notifyCustomer?: boolean;
  }
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) {
    return fail(403, "Only a manager can schedule a visit.");
  }
  if (!isWorkProjectVisitType(input.visitType)) return fail(400, "Choose a visit type.");
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return fail(400, "Choose a start time.");
  const minutes = Number(input.durationMinutes);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 24 * 60) {
    return fail(400, "Duration must be between 15 minutes and 24 hours.");
  }
  const assignees = [...new Set(input.assigneeIds)];
  if (!assignees.length) return fail(400, "Assign at least one team member.");
  for (const userId of assignees) {
    const user = await companyUser(loaded.data.project.client_id, userId);
    if (!user) return fail(400, "An assignee is not a user in this company.");
    const onProject = loaded.data.scope.member_user_ids.includes(userId) || loaded.data.project.project_owner_id === userId;
    if (!onProject) return fail(400, "Assign someone who is already on this project.");
  }
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  const siteAddress = input.siteAddress?.trim() || loaded.data.project.site_address;
  const title = `${workProjectVisitTypeLabel(input.visitType)} — ${loaded.data.project.title}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_project_visits")
    .insert({
      client_id: loaded.data.project.client_id,
      project_id: projectId,
      visit_type: input.visitType,
      title,
      status: "SCHEDULED",
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      site_name: loaded.data.project.site_name,
      site_address: siteAddress,
      site_city: loaded.data.project.site_city,
      assigned_lead_id: assignees[0],
      customer_contact_id: loaded.data.project.contact_id,
      instructions: input.instructions?.trim() || null,
      created_by: actor.userId,
    })
    .select("id")
    .single();
  if (error || !data) return fail(500, "Could not schedule the visit.");
  const visitId = data.id as string;
  const { error: assigneeError } = await supabase.from("work_project_visit_assignees").insert(
    assignees.map((userId) => ({
      client_id: loaded.data.project.client_id,
      visit_id: visitId,
      project_id: projectId,
      user_id: userId,
    }))
  );
  if (assigneeError) return fail(500, "The visit was created but the team could not be assigned.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "VISIT_SCHEDULED",
    title: "Visit scheduled",
    description: title,
    metadata: {
      visit_id: visitId,
      visit_type: input.visitType,
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
    },
  });
  await notifyUsers(
    assignees,
    `${workProjectVisitTypeLabel(input.visitType)} scheduled on ${loaded.data.project.project_number} for ${start.toLocaleString()}.`
  );
  let customerNotice: string | null = null;
  if (input.notifyCustomer) {
    if (!loaded.data.project.lead_id) {
      customerNotice = "The visit is scheduled. This project has no WhatsApp conversation to notify.";
    } else {
      const when = start.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      const text = `Your ${workProjectVisitTypeLabel(input.visitType).toLowerCase()} has been scheduled for ${when}.`;
      const sent = await sendWhatsAppTextToLead({
        leadId: loaded.data.project.lead_id,
        text,
        actorId: actor.userId,
        actorName: "SegmiQ",
        actorRole: actor.role,
      });
      customerNotice = sent.ok ? "Customer notified on WhatsApp." : sent.error || "WhatsApp could not be sent.";
    }
  }
  return { ok: true as const, data: { id: visitId, customerNotice } };
}

export async function rescheduleProjectVisit(
  actor: WorkProjectActor,
  projectId: string,
  visitId: string,
  input: { startAt: string; durationMinutes: number }
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can reschedule a visit.");
  const supabase = createAdminClient();
  const { data: visit } = await supabase
    .from("work_project_visits")
    .select("*")
    .eq("id", visitId)
    .eq("project_id", projectId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!visit) return fail(404, "Visit not found.");
  if (closedVisit(visit.status as string)) return fail(400, "This visit can no longer be rescheduled.");
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return fail(400, "Choose a start time.");
  const minutes = Number(input.durationMinutes);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 24 * 60) return fail(400, "Duration must be between 15 minutes and 24 hours.");
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  if (visit.scheduled_start_at === start.toISOString() && visit.scheduled_end_at === end.toISOString()) {
    return { ok: true as const, data: { id: visitId, unchanged: true } };
  }
  const previous = { start: visit.scheduled_start_at, end: visit.scheduled_end_at };
  const { error } = await supabase
    .from("work_project_visits")
    .update({
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      status: "SCHEDULED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitId);
  if (error) return fail(500, "Could not reschedule the visit.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "VISIT_RESCHEDULED",
    title: "Visit rescheduled",
    description: visit.title as string,
    metadata: { visit_id: visitId, previous, next: { start: start.toISOString(), end: end.toISOString() } },
  });
  return { ok: true as const, data: { id: visitId, unchanged: false } };
}

export async function cancelProjectVisit(
  actor: WorkProjectActor,
  projectId: string,
  visitId: string,
  reason: string
) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can cancel a visit.");
  const clean = reason.trim();
  if (!clean || !VISIT_CANCEL_REASONS.includes(clean as (typeof VISIT_CANCEL_REASONS)[number]) && !clean.startsWith("Other:")) {
    return fail(400, "Choose a cancellation reason.");
  }
  const supabase = createAdminClient();
  const { data: visit } = await supabase
    .from("work_project_visits")
    .select("id, status, title, cancelled_at")
    .eq("id", visitId)
    .eq("project_id", projectId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!visit) return fail(404, "Visit not found.");
  if (visit.status === "CANCELLED") return { ok: true as const, data: { id: visitId, unchanged: true } };
  const { error } = await supabase
    .from("work_project_visits")
    .update({
      status: "CANCELLED",
      cancellation_reason: clean,
      cancelled_at: visit.cancelled_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitId);
  if (error) return fail(500, "Could not cancel the visit.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "VISIT_CANCELLED",
    title: "Visit cancelled",
    description: clean,
    metadata: { visit_id: visitId, reason: clean },
  });
  return { ok: true as const, data: { id: visitId, unchanged: false } };
}

async function loadVisitForActor(actor: WorkProjectActor, projectId: string, visitId: string) {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  const supabase = createAdminClient();
  const { data: visit } = await supabase
    .from("work_project_visits")
    .select("*")
    .eq("id", visitId)
    .eq("project_id", projectId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!visit) return fail(404, "Visit not found.");
  const { data: assignees } = await supabase
    .from("work_project_visit_assignees")
    .select("user_id")
    .eq("visit_id", visitId)
    .eq("client_id", loaded.data.project.client_id);
  const assigneeIds = ((assignees ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
  return { ok: true as const, data: { loaded, visit, assigneeIds } };
}

export async function saveAssessmentDraft(
  actor: WorkProjectActor,
  projectId: string,
  visitId: string,
  raw: unknown
) {
  const scoped = await loadVisitForActor(actor, projectId, visitId);
  if (!scoped.ok) return scoped;
  const { loaded, visit, assigneeIds } = scoped.data;
  const canEdit = canManageWorkProjects(actor, loaded.data.project.client_id) || assigneeIds.includes(actor.userId);
  if (!canEdit) return fail(403, "You cannot edit this assessment.");
  if (visit.visit_type !== "SITE_ASSESSMENT") return fail(400, "This visit does not have a site assessment.");
  const parsed = parseSolarAssessment(raw);
  if (!parsed.ok) return fail(400, parsed.error);
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("work_project_visit_assessments")
    .select("id, status")
    .eq("visit_id", visitId)
    .maybeSingle();
  if (existing?.status === "COMPLETED") return { ok: true as const, data: { status: "COMPLETED" as const } };
  if (!existing) {
    const { error } = await supabase.from("work_project_visit_assessments").insert({
      client_id: loaded.data.project.client_id,
      project_id: projectId,
      visit_id: visitId,
      assessment_type: "SITE_ASSESSMENT",
      schema_version: 1,
      status: "DRAFT",
      data: parsed.data,
    });
    if (error) return fail(500, "Could not save the assessment.");
  } else {
    const { error } = await supabase
      .from("work_project_visit_assessments")
      .update({ data: parsed.data, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("client_id", loaded.data.project.client_id);
    if (error) return fail(500, "Could not save the assessment.");
  }
  return { ok: true as const, data: { status: "DRAFT" as const } };
}

export async function completeSiteAssessment(
  actor: WorkProjectActor,
  projectId: string,
  visitId: string,
  raw: unknown
) {
  const scoped = await loadVisitForActor(actor, projectId, visitId);
  if (!scoped.ok) return scoped;
  const { loaded, visit, assigneeIds } = scoped.data;
  const canEdit = canManageWorkProjects(actor, loaded.data.project.client_id) || assigneeIds.includes(actor.userId);
  if (!canEdit) return fail(403, "You cannot complete this assessment.");
  if (visit.visit_type !== "SITE_ASSESSMENT") return fail(400, "This visit does not have a site assessment.");
  const parsed = parseSolarAssessment(raw);
  if (!parsed.ok) return fail(400, parsed.error);
  const addressError = solarAssessmentCompletionError(parsed.data, (visit.site_address as string | null) ?? loaded.data.project.site_address);
  if (addressError) return fail(400, addressError);
  const summary = [solarOutcomeLabel(parsed.data.outcome), solarLoadSummary(parsed.data)].filter(Boolean).join(". ");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("complete_work_project_assessment", {
    p_client_id: loaded.data.project.client_id,
    p_visit_id: visitId,
    p_actor_id: actor.userId,
    p_summary: summary,
    p_data: parsed.data,
  });
  if (error || !data || (data as { ok?: boolean }).ok === false) {
    return fail(500, "Could not complete the assessment.");
  }
  return { ok: true as const, data: { completed: true, summary } };
}

export async function attachAssessmentPhoto(
  actor: WorkProjectActor,
  projectId: string,
  visitId: string,
  documentId: string,
  category: string
) {
  const scoped = await loadVisitForActor(actor, projectId, visitId);
  if (!scoped.ok) return scoped;
  const { loaded, assigneeIds } = scoped.data;
  const canEdit = canManageWorkProjects(actor, loaded.data.project.client_id) || assigneeIds.includes(actor.userId);
  if (!canEdit) return fail(403, "You cannot add photos to this visit.");
  const supabase = createAdminClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("client_id", loaded.data.project.client_id)
    .maybeSingle();
  if (!document) return fail(400, "That document is not in this company.");
  const { createManualDocumentLink } = await import("@/lib/documents/linking/store");
  const link = await createManualDocumentLink({
    clientId: loaded.data.project.client_id,
    documentId,
    actorUserId: actor.userId,
      candidate: {
        entityType: "WORK_PROJECT_VISIT",
        entityId: visitId,
        linkType: "MANUAL",
        confidence: "HIGH",
        matchReason: category,
        label: "Visit",
        metadata: { category },
      },
  });
  if (!link) return fail(500, "Could not link the photo to this visit.");
  const { data: assessment } = await supabase
    .from("work_project_visit_assessments")
    .select("id, data, status")
    .eq("visit_id", visitId)
    .maybeSingle();
  const current = parseSolarAssessment(assessment?.data ?? emptySolarAssessment());
  if (!current.ok) return fail(400, current.error);
  if (!current.data.photos.some((photo) => photo.documentId === documentId && photo.category === category)) {
    current.data.photos.push({ documentId, category, note: null });
  }
  if (!assessment) {
    await supabase.from("work_project_visit_assessments").insert({
      client_id: loaded.data.project.client_id,
      project_id: projectId,
      visit_id: visitId,
      data: current.data,
      status: "DRAFT",
    });
  } else if (assessment.status !== "COMPLETED") {
    await supabase
      .from("work_project_visit_assessments")
      .update({ data: current.data, updated_at: new Date().toISOString() })
      .eq("id", assessment.id);
  }
  return { ok: true as const, data: { linked: true } };
}

export type ProjectFieldSnapshot = {
  members: Array<{ id: string; userId: string; name: string | null; role: string }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    taskType: string;
    status: string;
    priority: string;
    assignedToId: string | null;
    assigneeName: string | null;
    dueAt: string | null;
    overdue: boolean;
  }>;
  visits: Array<{
    id: string;
    visitType: string;
    title: string;
    status: string;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    siteAddress: string | null;
    assigneeNames: string[];
    assigneeIds: string[];
    instructions: string | null;
    outcomeSummary: string | null;
    overdue: boolean;
    canEditAssessment: boolean;
  }>;
  assessments: Array<{
    visitId: string;
    status: string;
    summary: string | null;
    completedAt: string | null;
    data: SolarAssessmentData;
  }>;
  attention: string[];
  canManageTeam: boolean;
};

export async function loadProjectField(actor: WorkProjectActor, projectId: string): Promise<ServiceResult<ProjectFieldSnapshot>> {
  const loaded = await projectScope(actor, projectId);
  if (!loaded.ok) return loaded;
  const supabase = createAdminClient();
  const clientId = loaded.data.project.client_id;
  const [{ data: members }, { data: tasks }, { data: visits }, { data: assessments }, { data: assignees }] = await Promise.all([
    supabase.from("work_project_members").select("id, user_id, project_role").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_tasks").select("*").eq("project_id", projectId).eq("client_id", clientId).order("due_at", { ascending: true }),
    supabase.from("work_project_visits").select("*").eq("project_id", projectId).eq("client_id", clientId).order("scheduled_start_at", { ascending: true }),
    supabase.from("work_project_visit_assessments").select("*").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_visit_assignees").select("visit_id, user_id").eq("project_id", projectId).eq("client_id", clientId),
  ]);
  const userIds = [
    ...((members ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    ...((tasks ?? []) as Array<{ assigned_to_id: string | null }>).map((row) => row.assigned_to_id).filter(Boolean),
    ...((assignees ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
  ] as string[];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, name").in("id", [...new Set(userIds)])
    : { data: [] };
  const names = new Map(((users ?? []) as Array<{ id: string; name: string | null }>).map((user) => [user.id, user.name]));
  const assigneesByVisit = new Map<string, string[]>();
  for (const row of (assignees ?? []) as Array<{ visit_id: string; user_id: string }>) {
    const list = assigneesByVisit.get(row.visit_id) ?? [];
    list.push(row.user_id);
    assigneesByVisit.set(row.visit_id, list);
  }
  const isManager = canManageWorkProjects(actor, clientId);
  const taskRows = ((tasks ?? []) as Array<Record<string, string | null>>).map((task) => ({
    id: task.id as string,
    title: task.title as string,
    description: task.description,
    taskType: task.task_type as string,
    status: task.status as string,
    priority: task.priority as string,
    assignedToId: task.assigned_to_id,
    assigneeName: task.assigned_to_id ? names.get(task.assigned_to_id) ?? null : null,
    dueAt: task.due_at,
    overdue: isTaskOverdue({ status: task.status as string, due_at: task.due_at }),
  }));
  const visitRows = ((visits ?? []) as Array<Record<string, string | null>>).map((visit) => {
    const ids = assigneesByVisit.get(visit.id as string) ?? [];
    return {
      id: visit.id as string,
      visitType: visit.visit_type as string,
      title: visit.title as string,
      status: visit.status as string,
      scheduledStartAt: visit.scheduled_start_at,
      scheduledEndAt: visit.scheduled_end_at,
      siteAddress: visit.site_address,
      assigneeNames: ids.map((id) => names.get(id) || "Team member"),
      assigneeIds: ids,
      instructions: visit.instructions,
      outcomeSummary: visit.outcome_summary,
      overdue: isVisitOverdue({
        status: visit.status as string,
        scheduled_end_at: visit.scheduled_end_at,
        scheduled_start_at: visit.scheduled_start_at,
      }),
      canEditAssessment: visit.visit_type === "SITE_ASSESSMENT" && (isManager || ids.includes(actor.userId)),
    };
  });
  const assessmentRows = ((assessments ?? []) as Array<Record<string, unknown>>).map((row) => {
    const parsed = parseSolarAssessment(row.data);
    return {
      visitId: row.visit_id as string,
      status: row.status as string,
      summary: (row.summary as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      data: parsed.ok ? parsed.data : emptySolarAssessment(),
    };
  });
  const memberRows = ((members ?? []) as Array<{ id: string; user_id: string; project_role: string }>).map((member) => ({
    id: member.id,
    userId: member.user_id,
    name: names.get(member.user_id) ?? null,
    role: member.project_role,
  }));
  return {
    ok: true,
    data: {
      members: memberRows,
      tasks: taskRows,
      visits: visitRows,
      assessments: assessmentRows,
      attention: fieldAttention({
        projectStatus: loaded.data.project.status,
        members: memberRows,
        tasks: taskRows.map((task) => ({ status: task.status, due_at: task.dueAt })),
        visits: visitRows.map((visit) => ({
          visit_type: visit.visitType,
          status: visit.status,
          scheduled_end_at: visit.scheduledEndAt,
          scheduled_start_at: visit.scheduledStartAt,
        })),
        assessmentCompleted: assessmentRows.some((row) => row.status === "COMPLETED"),
      }),
      canManageTeam: isManager,
    },
  };
}

export async function loadOperationsSummary(clientId: string) {
  const trades = await assertTrades(clientId);
  if (!trades.ok) return null;
  const supabase = createAdminClient();
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const [{ data: visits }, { data: tasks }, { data: projects }, { data: assessments }] = await Promise.all([
    supabase.from("work_project_visits").select("id, status, visit_type, scheduled_start_at, scheduled_end_at").eq("client_id", clientId),
    supabase.from("work_project_tasks").select("status, due_at").eq("client_id", clientId),
    supabase.from("work_projects").select("id, status, project_owner_id").eq("client_id", clientId),
    supabase.from("work_project_visit_assessments").select("project_id, status").eq("client_id", clientId).eq("status", "COMPLETED"),
  ]);
  const visitRows = (visits ?? []) as Array<{ status: string; visit_type: string; scheduled_start_at: string | null; scheduled_end_at: string | null }>;
  const completedProjects = new Set(((assessments ?? []) as Array<{ project_id: string }>).map((row) => row.project_id));
  return {
    visitsToday: visitRows.filter((visit) => {
      if (!visit.scheduled_start_at || visit.status === "CANCELLED") return false;
      const time = new Date(visit.scheduled_start_at).getTime();
      return time >= start.getTime() && time < end.getTime();
    }).length,
    upcomingAssessments: visitRows.filter((visit) => visit.visit_type === "SITE_ASSESSMENT" && visit.status === "SCHEDULED" && visit.scheduled_start_at && new Date(visit.scheduled_start_at) >= now).length,
    overdueVisits: visitRows.filter((visit) => isVisitOverdue(visit, now)).length,
    overdueTasks: ((tasks ?? []) as Array<{ status: string; due_at: string | null }>).filter((task) => isTaskOverdue(task, now)).length,
    projectsWithoutOwner: ((projects ?? []) as Array<{ project_owner_id: string | null; status: string }>).filter((project) => !project.project_owner_id && project.status !== "COMPLETED" && project.status !== "CANCELLED").length,
    waitingAfterAssessment: ((projects ?? []) as Array<{ id: string; status: string }>).filter((project) => project.status === "SITE_ASSESSMENT" && completedProjects.has(project.id)).length,
  };
}

export async function listMyWork(actor: WorkProjectActor) {
  if (!actor.clientId) return fail(403, "Missing company.");
  const trades = await assertTrades(actor.clientId);
  if (!trades.ok) return trades;
  const supabase = createAdminClient();
  const [{ data: taskRows }, { data: assigneeRows }] = await Promise.all([
    supabase.from("work_project_tasks").select("id, project_id, title, status, due_at, priority").eq("client_id", actor.clientId).eq("assigned_to_id", actor.userId),
    supabase.from("work_project_visit_assignees").select("visit_id, project_id").eq("client_id", actor.clientId).eq("user_id", actor.userId),
  ]);
  const visitIds = ((assigneeRows ?? []) as Array<{ visit_id: string }>).map((row) => row.visit_id);
  const { data: visits } = visitIds.length
    ? await supabase.from("work_project_visits").select("id, project_id, title, visit_type, status, scheduled_start_at, scheduled_end_at, site_address").in("id", visitIds).eq("client_id", actor.clientId)
    : { data: [] };
  const projectIds = [
    ...((taskRows ?? []) as Array<{ project_id: string }>).map((row) => row.project_id),
    ...((visits ?? []) as Array<{ project_id: string }>).map((row) => row.project_id),
  ];
  const { data: projects } = projectIds.length
    ? await supabase.from("work_projects").select("id, title, project_number, client_id").in("id", [...new Set(projectIds)]).eq("client_id", actor.clientId)
    : { data: [] };
  const projectById = new Map(((projects ?? []) as Array<{ id: string; title: string; project_number: string }>).map((project) => [project.id, project]));
  const now = new Date();
  return {
    ok: true as const,
    data: {
      tasks: ((taskRows ?? []) as Array<{ id: string; project_id: string; title: string; status: string; due_at: string | null; priority: string }>)
        .filter((task) => projectById.has(task.project_id))
        .map((task) => ({
          ...task,
          overdue: isTaskOverdue(task, now),
          projectTitle: projectById.get(task.project_id)?.title ?? "Project",
          projectNumber: projectById.get(task.project_id)?.project_number ?? "",
        })),
      visits: ((visits ?? []) as Array<{ id: string; project_id: string; title: string; visit_type: string; status: string; scheduled_start_at: string | null; scheduled_end_at: string | null; site_address: string | null }>)
        .map((visit) => ({
          ...visit,
          overdue: isVisitOverdue(visit, now),
          projectTitle: projectById.get(visit.project_id)?.title ?? "Project",
          projectNumber: projectById.get(visit.project_id)?.project_number ?? "",
        })),
    },
  };
}

export async function listOperationalCalendar(clientId: string, rangeStart: string, rangeEnd: string) {
  const trades = await assertTrades(clientId);
  if (!trades.ok) return { visits: [], projectStarts: [] };
  const supabase = createAdminClient();
  const [{ data: visits }, { data: projects }] = await Promise.all([
    supabase
      .from("work_project_visits")
      .select("id, project_id, title, visit_type, status, scheduled_start_at, scheduled_end_at, site_address, assigned_lead_id")
      .eq("client_id", clientId)
      .gte("scheduled_start_at", rangeStart)
      .lt("scheduled_start_at", rangeEnd)
      .neq("status", "CANCELLED"),
    supabase
      .from("work_projects")
      .select("id, title, project_number, scheduled_start_at, site_address, project_owner_id")
      .eq("client_id", clientId)
      .gte("scheduled_start_at", rangeStart)
      .lt("scheduled_start_at", rangeEnd),
  ]);
  return {
    visits: visits ?? [],
    projectStarts: projects ?? [],
  };
}

export function assessmentPublicSummary(data: SolarAssessmentData) {
  return {
    address: data.site.address,
    grid: data.power.gridAvailable,
    generator: data.power.generatorPresent,
    roof: data.roof.roofType,
    shade: data.roof.shading,
    outcome: solarOutcomeLabel(data.outcome),
    loads: solarLoadSummary(data),
    photos: data.photos.length,
    equipmentNotes: data.equipment.cableNotes || data.equipment.inverterLocation,
  };
}

export function canReadField(actor: WorkProjectActor, row: Parameters<typeof canReadWorkProject>[1]) {
  return canReadWorkProject(actor, row);
}
