import { resolveNaturalDateTime } from "@/lib/agent/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageWorkProjects, canUpdateWorkProject, type WorkProjectActor } from "@/lib/work-projects/access";
import { getWorkProject } from "@/lib/work-projects/service";
import { scheduleInstallation } from "@/lib/work-projects/installation-service";
import { logAiAction, logAiUsage } from "@/lib/intelligence/audit";
import { listOperationsAttention, loadProjectFacts, resolveProjectsByName } from "@/lib/intelligence/facts";
import {
  balanceAnswer,
  customerUpdateDraft,
  installationBrief,
  installationDateAnswer,
  installationReadinessAnswer,
  paymentAnswer,
  projectSummary,
  type ProjectFacts,
} from "@/lib/intelligence/rules";

export type StaffAnswer = {
  answer: string;
  citations: string[];
  warnings: string[];
  pendingActionId: string | null;
};

function citations(facts: ProjectFacts): string[] {
  const lines = ["Work project record", "Confirmed payments"];
  if (facts.assessmentCompleted) lines.push("Site assessment");
  if (facts.installationStatus) lines.push("Installation record");
  return lines;
}

async function oneProject(actor: WorkProjectActor, question: string, projectId?: string | null): Promise<{ facts: ProjectFacts | null; answer?: string }> {
  if (projectId) {
    const facts = await loadProjectFacts(actor, projectId);
    return { facts, answer: facts ? undefined : "I couldn't find that project in your company." };
  }
  const named = question.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  const guess = named?.[1] && !/^(What|When|How|Which|Is|Has|Prepare|Draft|Create|Show|Who)$/.test(named[1]) ? named[1] : null;
  if (!guess) return { facts: null, answer: "Tell me which customer or project you mean." };
  const matches = await resolveProjectsByName(actor, guess);
  if (matches.length > 1) {
    return { facts: null, answer: `I found more than one match. I haven't chosen one.\n${matches.map((row) => row.label).join("\n")}` };
  }
  if (!matches.length) return { facts: null, answer: "I couldn't find that customer on a project you can open." };
  return { facts: await loadProjectFacts(actor, matches[0].projectId) };
}

export async function answerStaffQuestion(actor: WorkProjectActor, question: string, projectId?: string | null): Promise<StaffAnswer> {
  const clientId = actor.clientId;
  if (!clientId) return { answer: "I don't have a company context for this request.", citations: [], warnings: [], pendingActionId: null };
  const text = question.trim();
  await logAiUsage({ clientId, userId: actor.userId, feature: "staff_ask", model: "deterministic" });

  if (/\b(confirm|mark).*(payment|paid)\b/i.test(text)) {
    const denied = actor.role === "SALESPERSON";
    const answer = denied
      ? "You don't have permission to confirm customer payments."
      : "Confirming a customer payment stays on the payment record. I have not marked any money as received.";
    await logAiAction({ clientId, userId: actor.userId, toolName: "confirm_payment", riskLevel: "WRITE_HIGH", argumentsSummary: { refused: true }, resultSummary: answer, approvalRequired: true, status: "FAILED" });
    return { answer, citations: [], warnings: [], pendingActionId: null };
  }

  if (/\b(attention|blocked|payment proof|require qa|ready to complete|unresolved)\b/i.test(text) && !projectId) {
    const items = await listOperationsAttention(actor);
    const answer = items.length
      ? items.slice(0, 12).map((item) => `${item.title}: ${item.detail}`).join("\n")
      : "Nothing in the operations checks needs attention right now.";
    await logAiAction({ clientId, userId: actor.userId, toolName: "list_operations_attention", riskLevel: "READ", argumentsSummary: { count: items.length }, resultSummary: answer, approvalRequired: false, status: "COMPLETED" });
    return { answer, citations: ["Project payments", "Equipment", "Installation", "Support"], warnings: [], pendingActionId: null };
  }

  const resolved = await oneProject(actor, text, projectId);
  if (!resolved.facts) return { answer: resolved.answer || "I couldn't find that project.", citations: [], warnings: [], pendingActionId: null };
  const facts = resolved.facts;

  if (/\b(task|remind)\b/i.test(text)) {
    return proposeTask(actor, facts, text);
  }
  if (/\bfollow up\b/i.test(text)) {
    return proposeFollowUp(actor, facts, text);
  }
  if (/\bschedule\b/i.test(text) && /\binstallation\b/i.test(text)) {
    return proposeSchedule(actor, facts, text);
  }

  let answer = projectSummary(facts);
  let tool = "get_project_summary";
  if (/\b(ready|blocked|missing)\b/i.test(text)) {
    answer = installationReadinessAnswer(facts).answer;
    tool = "get_project_attention";
  } else if (/\b(paid|payment|deposit)\b/i.test(text) && !/\bowe|outstanding|balance\b/i.test(text)) {
    answer = paymentAnswer(facts);
    tool = "get_payment_summary";
  } else if (/\b(owe|outstanding|balance)\b/i.test(text)) {
    answer = balanceAnswer(facts);
    tool = "get_payment_summary";
  } else if (/\b(when|installation date|installing)\b/i.test(text)) {
    answer = installationDateAnswer(facts.installationScheduledAt);
    tool = "get_installation";
  } else if (/\bbrief\b/i.test(text)) {
    answer = installationBrief(facts);
    tool = "prepare_installation_brief";
  } else if (/\b(draft|update).*(customer|tendai|him|her)\b/i.test(text) || /\bcustomer update\b/i.test(text)) {
    answer = customerUpdateDraft(facts);
    tool = "draft_customer_update";
  }
  await logAiAction({ clientId, userId: actor.userId, toolName: tool, riskLevel: tool.startsWith("draft") || tool.startsWith("prepare") ? "PREPARE" : "READ", argumentsSummary: { projectId: facts.projectId }, resultSummary: answer, approvalRequired: false, status: "COMPLETED" });
  return { answer, citations: citations(facts), warnings: facts.equipmentGaps.map((gap) => `${gap.missing} ${gap.description} missing`), pendingActionId: null };
}

async function proposeTask(actor: WorkProjectActor, facts: ProjectFacts, text: string): Promise<StaffAnswer> {
  const clientId = actor.clientId as string;
  const loaded = await getWorkProject(actor, facts.projectId);
  if (!loaded.ok || !canUpdateWorkProject(actor, loaded.data.scope)) {
    return { answer: "You don't have permission to create a task on this project.", citations: [], warnings: [], pendingActionId: null };
  }
  const who = text.match(/\b(?:for|remind)\s+([A-Z][a-z]+)/);
  const name = who?.[1] || null;
  let assigneeId: string | null = null;
  if (name) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("users").select("id, name").eq("client_id", clientId).ilike("name", `${name}%`).limit(5);
    if ((data ?? []).length > 1) {
      return { answer: `I found more than one person named ${name}. I haven't assigned anyone yet.`, citations: [], warnings: [], pendingActionId: null };
    }
    assigneeId = (data?.[0]?.id as string | undefined) ?? null;
    if (!assigneeId) return { answer: `I couldn't find ${name} on this company. I haven't created a task.`, citations: [], warnings: [], pendingActionId: null };
  }
  const when = resolveNaturalDateTime(text, { timezone: "Africa/Harare" });
  const due = when?.iso ?? null;
  const title = /battery/i.test(text) ? "Check battery stock" : "Project task";
  const summary = `Create “${title}” on ${facts.number || facts.title}${name ? ` for ${name}` : ""}${when ? ` due ${when.localDate}${when.daypart ? ` ${when.daypart}` : ""}` : ""}. Nothing is saved until you approve.`;
  const id = await logAiAction({
    clientId,
    userId: actor.userId,
    toolName: "create_project_task",
    riskLevel: "WRITE_LOW",
    argumentsSummary: { projectId: facts.projectId, title, assigneeId, dueAt: due },
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: citations(facts), warnings: [], pendingActionId: id };
}

async function proposeFollowUp(actor: WorkProjectActor, facts: ProjectFacts, text: string): Promise<StaffAnswer> {
  const clientId = actor.clientId as string;
  const when = resolveNaturalDateTime(text, { timezone: "Africa/Harare" });
  const summary = `Schedule a sales follow-up for ${facts.contactName}${when ? ` on ${when.localDate}` : ""}. This does not create a project task. Nothing is saved until you approve.`;
  const id = await logAiAction({
    clientId,
    userId: actor.userId,
    toolName: "schedule_sales_follow_up",
    riskLevel: "WRITE_LOW",
    argumentsSummary: { projectId: facts.projectId, dueAt: when?.iso ?? null },
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: ["Lead follow-up"], warnings: [], pendingActionId: id };
}

async function proposeSchedule(actor: WorkProjectActor, facts: ProjectFacts, text: string): Promise<StaffAnswer> {
  const readiness = installationReadinessAnswer(facts);
  if (!canManageWorkProjects(actor, actor.clientId || "")) {
    return { answer: "You don't have permission to schedule an installation.", citations: citations(facts), warnings: [], pendingActionId: null };
  }
  const when = resolveNaturalDateTime(text, { timezone: "Africa/Harare" });
  const summary = [
    `${facts.contactName} — ${facts.number || facts.title}`,
    when ? `Proposed start: ${when.localDate} ${when.localTime || when.daypart || ""}`.trim() : "No date was clear enough to schedule.",
    readiness.answer,
    "I have not scheduled the installation.",
  ].join("\n");
  if (!when?.timeKnown && !when?.daypart) {
    return { answer: summary, citations: citations(facts), warnings: facts.equipmentGaps.map((gap) => `${gap.missing} ${gap.description} missing`), pendingActionId: null };
  }
  const id = await logAiAction({
    clientId: actor.clientId as string,
    userId: actor.userId,
    toolName: "schedule_installation",
    riskLevel: "WRITE_HIGH",
    argumentsSummary: { projectId: facts.projectId, startAt: when.iso, acknowledgeExceptions: facts.equipmentGaps.length > 0 },
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: citations(facts), warnings: facts.equipmentGaps.map((gap) => `${gap.missing} ${gap.description} missing`), pendingActionId: id };
}

export async function approveStaffAction(actor: WorkProjectActor, actionId: string, decision: "approve" | "cancel") {
  if (!actor.clientId) return { ok: false as const, error: "Unauthorised." };
  const supabase = createAdminClient();
  const { data } = await supabase.from("ai_action_log").select("*").eq("id", actionId).eq("client_id", actor.clientId).eq("user_id", actor.userId).maybeSingle();
  if (!data || data.status !== "PENDING") return { ok: false as const, error: "That action is no longer waiting." };
  if (decision === "cancel") {
    await supabase.from("ai_action_log").update({ status: "CANCELLED" }).eq("id", actionId);
    return { ok: true as const, message: "Cancelled. Nothing was changed." };
  }
  const args = (data.arguments_summary || {}) as Record<string, unknown>;
  const tool = data.tool_name as string;
  if (tool === "create_project_task") {
    const { error } = await supabase.from("work_project_tasks").insert({
      client_id: actor.clientId,
      project_id: args.projectId,
      title: args.title || "Project task",
      assigned_to_id: args.assigneeId || null,
      due_at: args.dueAt || null,
      created_by: actor.userId,
      task_type: "INSTALLATION_PREP",
    });
    if (error) {
      await supabase.from("ai_action_log").update({ status: "FAILED", result_summary: "I couldn't create the task." }).eq("id", actionId);
      return { ok: false as const, error: "I couldn't create the task." };
    }
  } else if (tool === "schedule_sales_follow_up") {
    const loaded = await getWorkProject(actor, String(args.projectId));
    if (!loaded.ok || !loaded.data.project.lead_id) {
      await supabase.from("ai_action_log").update({ status: "FAILED", result_summary: "This project has no sales lead to follow up." }).eq("id", actionId);
      return { ok: false as const, error: "This project has no sales lead to follow up." };
    }
    const { error } = await supabase.from("leads").update({ follow_up_date: args.dueAt || new Date().toISOString() }).eq("id", loaded.data.project.lead_id).eq("client_id", actor.clientId);
    if (error) return { ok: false as const, error: "I couldn't schedule the follow-up." };
  } else if (tool === "schedule_installation") {
    const current = await supabase.from("work_project_installations").select("id").eq("project_id", args.projectId).eq("client_id", actor.clientId).neq("status", "CANCELLED").limit(1).maybeSingle();
    if (!current.data?.id) return { ok: false as const, error: "There is no installation record to schedule yet." };
    const result = await scheduleInstallation(actor, String(args.projectId), {
      installationId: current.data.id as string,
      startAt: String(args.startAt),
      assigneeIds: [],
      acknowledgeExceptions: Boolean(args.acknowledgeExceptions),
    });
    if (!result.ok) {
      await supabase.from("ai_action_log").update({ status: "FAILED", result_summary: result.error }).eq("id", actionId);
      return { ok: false as const, error: result.error };
    }
  } else {
    return { ok: false as const, error: "That action is not available." };
  }
  await supabase.from("ai_action_log").update({ status: "COMPLETED", approved_by: actor.userId, approved_at: new Date().toISOString(), result_summary: "Approved and completed." }).eq("id", actionId);
  return { ok: true as const, message: "Done." };
}
