import { resolveNaturalDateTime } from "@/lib/agent/dates";
import { searchApprovedChunks } from "@/lib/company-brain/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageWorkProjects, canUpdateWorkProject, type WorkProjectActor } from "@/lib/work-projects/access";
import { getWorkProject } from "@/lib/work-projects/service";
import { scheduleInstallation } from "@/lib/work-projects/installation-service";
import { logAiAction, logAiUsage } from "@/lib/intelligence/audit";
import { appendMessage, openConversation } from "@/lib/intelligence/conversations";
import {
  companyTimezone,
  leadSummary,
  listOperationsAttention,
  listSalesFocus,
  loadLeadFacts,
  loadProjectFacts,
  loadSupportBrief,
  resolveProjectQuery,
} from "@/lib/intelligence/facts";
import { explainGroundedAnswer } from "@/lib/intelligence/narrate";
import { staffToolAllowed, toolRisk } from "@/lib/intelligence/registry";
import {
  balanceAnswer,
  customerUpdateDraft,
  guessCustomerToken,
  installationBrief,
  installationDateAnswer,
  installationReadinessAnswer,
  paymentAnswer,
  paymentConfirmAnswer,
  projectSummary,
  qualityAnswer,
  routeStaffIntent,
  stripTenantArgs,
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
  const guess = guessCustomerToken(question);
  if (!guess) return { facts: null, answer: "Tell me which customer or project you mean." };
  const matches = await resolveProjectQuery(actor, guess);
  if (matches.length > 1) {
    return { facts: null, answer: `I found more than one match. I haven't chosen one.\n${matches.map((row) => row.label).join("\n")}` };
  }
  if (!matches.length) return { facts: null, answer: "I couldn't find that customer on a project you can open." };
  return { facts: await loadProjectFacts(actor, matches[0].projectId) };
}

async function remember(actor: WorkProjectActor, question: string, answer: string, contextType: string, contextId?: string | null) {
  const clientId = actor.clientId;
  if (!clientId) return null;
  try {
    const conversationId = await openConversation({
      clientId,
      userId: actor.userId,
      audience: "STAFF",
      contextType,
      contextId,
    });
    await appendMessage({ conversationId, clientId, role: "user", content: question });
    await appendMessage({ conversationId, clientId, role: "assistant", content: answer });
    return conversationId;
  } catch {
    return null;
  }
}

export async function answerStaffQuestion(
  actor: WorkProjectActor,
  question: string,
  projectId?: string | null,
  opts?: { actionsEnabled?: boolean; leadId?: string | null }
): Promise<StaffAnswer> {
  const clientId = actor.clientId;
  if (!clientId) return { answer: "I don't have a company context for this request.", citations: [], warnings: [], pendingActionId: null };
  const text = question.trim();
  const intent = routeStaffIntent(text, { hasProject: Boolean(projectId), role: actor.role });
  const actionsEnabled = opts?.actionsEnabled !== false;

  if (intent === "deny_payment_confirm") {
    const answer = paymentConfirmAnswer(actor.role);
    await logAiAction({ clientId, userId: actor.userId, toolName: "confirm_payment", riskLevel: "WRITE_HIGH", argumentsSummary: stripTenantArgs({ refused: true }), resultSummary: answer, approvalRequired: true, status: "FAILED" });
    await logAiUsage({ clientId, userId: actor.userId, feature: "staff_ask", model: "deterministic" });
    return { answer, citations: [], warnings: [], pendingActionId: null };
  }

  if (intent === "operations_attention") {
    const items = await listOperationsAttention(actor);
    const answer = items.length
      ? items.slice(0, 12).map((item) => `${item.title}: ${item.detail}`).join("\n")
      : "Nothing in the operations checks needs attention right now.";
    await finishRead(actor, text, "list_operations_attention", answer, ["Project payments", "Equipment", "Installation", "Support"]);
    return { answer, citations: ["Project payments", "Equipment", "Installation", "Support"], warnings: [], pendingActionId: null };
  }

  if (intent === "sales_focus") {
    const items = await listSalesFocus(actor);
    const answer = items.length
      ? items.map((item) => `${item.title}: ${item.detail}`).join("\n")
      : "No overdue follow-ups are on your leads right now.";
    await finishRead(actor, text, "list_sales_focus", answer, ["Leads", "Follow-up dates"]);
    return { answer, citations: ["Leads", "Follow-up dates"], warnings: [], pendingActionId: null };
  }

  if (intent === "policy" && !projectId) {
    const chunks = await searchApprovedChunks(clientId, text, 3).catch(() => []);
    const answer = chunks.length
      ? `Approved company knowledge, which does not override a live project record:\n${chunks.map((chunk) => chunk.content.slice(0, 280)).join("\n")}`
      : "I don't have an approved Company Brain passage for that. I won't guess company policy.";
    await finishRead(actor, text, "search_company_policy", answer, ["Company Brain"]);
    return { answer, citations: ["Company Brain"], warnings: [], pendingActionId: null };
  }

  if (!projectId && opts?.leadId && intent === "summary") {
    const lead = await loadLeadFacts(actor, opts.leadId);
    const answer = lead ? leadSummary(lead) : "I couldn't find that lead in your company.";
    await finishRead(actor, text, "get_lead_summary", answer, ["Lead record"]);
    return { answer, citations: lead ? ["Lead record"] : [], warnings: [], pendingActionId: null };
  }

  const resolved = await oneProject(actor, text, projectId);
  if (!resolved.facts) return { answer: resolved.answer || "I couldn't find that project.", citations: [], warnings: [], pendingActionId: null };
  const facts = resolved.facts;
  const zone = await companyTimezone(clientId);

  if (intent === "create_task") return proposeTask(actor, facts, text, actionsEnabled, zone);
  if (intent === "add_note") return proposeNote(actor, facts, text, actionsEnabled);
  if (intent === "schedule_follow_up") return proposeFollowUp(actor, facts, text, actionsEnabled, zone);
  if (intent === "schedule_installation") return proposeSchedule(actor, facts, text, zone);

  let answer = projectSummary(facts);
  let tool = "get_project_summary";
  if (intent === "readiness") {
    answer = installationReadinessAnswer(facts).answer;
    tool = "get_project_attention";
  } else if (intent === "payment") {
    answer = paymentAnswer(facts);
    tool = "get_payment_summary";
  } else if (intent === "balance") {
    answer = balanceAnswer(facts);
    tool = "get_payment_summary";
  } else if (intent === "installation_date") {
    answer = installationDateAnswer(facts.installationScheduledAt);
    tool = "get_installation";
  } else if (intent === "installation_brief") {
    answer = installationBrief(facts);
    tool = "prepare_installation_brief";
  } else if (intent === "customer_update" || intent === "draft_message") {
    answer = `${customerUpdateDraft(facts)}\n\nI have not sent this.`;
    tool = "draft_customer_update";
  } else if (intent === "quality") {
    answer = qualityAnswer(facts.qaOutcome);
    tool = "get_installation";
  } else if (intent === "support_brief") {
    answer = (await loadSupportBrief(actor, facts.projectId)) || projectSummary(facts);
    tool = "prepare_support_brief";
  } else if (intent === "policy") {
    const chunks = await searchApprovedChunks(clientId, text, 2).catch(() => []);
    const policy = chunks.length ? chunks.map((chunk) => chunk.content.slice(0, 220)).join(" ") : "No approved company policy was found.";
    answer = `${projectSummary(facts)}\n\nThe project record is the source for this customer. Company policy, if it differs, does not replace it. ${policy}`;
    tool = "search_company_policy";
  }
  if (!staffToolAllowed(tool)) {
    return { answer: "That action is not available.", citations: [], warnings: [], pendingActionId: null };
  }
  const explained = toolRisk(tool) === "READ" || toolRisk(tool) === "PREPARE" ? await explainGroundedAnswer(answer) : { text: answer, model: "deterministic", inputTokens: 0, outputTokens: 0 };
  await finishRead(actor, text, tool, explained.text, citations(facts), facts.projectId, explained);
  return {
    answer: explained.text,
    citations: citations(facts),
    warnings: facts.equipmentGaps.map((gap) => `${gap.missing} ${gap.description} missing`),
    pendingActionId: null,
  };
}

async function finishRead(
  actor: WorkProjectActor,
  question: string,
  tool: string,
  answer: string,
  source: string[],
  projectId?: string,
  usage?: { model: string; inputTokens: number; outputTokens: number }
) {
  const clientId = actor.clientId as string;
  const conversationId = await remember(actor, question, answer, projectId ? "project" : "global", projectId);
  await logAiUsage({
    clientId,
    userId: actor.userId,
    feature: "staff_ask",
    model: usage?.model || "deterministic",
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });
  await logAiAction({
    clientId,
    userId: actor.userId,
    conversationId,
    toolName: tool,
    riskLevel: toolRisk(tool),
    argumentsSummary: stripTenantArgs({ projectId: projectId ?? null, sources: source }),
    resultSummary: answer,
    approvalRequired: false,
    status: "COMPLETED",
  });
}

function actionsOff(): StaffAnswer {
  return { answer: "Agent actions are turned off for this company. I have not changed any record.", citations: [], warnings: [], pendingActionId: null };
}

async function proposeNote(actor: WorkProjectActor, facts: ProjectFacts, text: string, actionsEnabled: boolean): Promise<StaffAnswer> {
  if (!actionsEnabled) return actionsOff();
  const loaded = await getWorkProject(actor, facts.projectId);
  if (!loaded.ok || !canUpdateWorkProject(actor, loaded.data.scope)) {
    return { answer: "You don't have permission to add a note on this project.", citations: [], warnings: [], pendingActionId: null };
  }
  const note = text.replace(/^.*\bnote\b[:\s-]*/i, "").trim().slice(0, 500) || text.slice(0, 500);
  const summary = `Add an internal note on ${facts.number || facts.title}: “${note}”. Nothing is saved until you approve.`;
  const id = await logAiAction({
    clientId: actor.clientId as string,
    userId: actor.userId,
    toolName: "add_project_note",
    riskLevel: "WRITE_LOW",
    argumentsSummary: stripTenantArgs({ projectId: facts.projectId, note }),
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: citations(facts), warnings: [], pendingActionId: id };
}

async function proposeTask(actor: WorkProjectActor, facts: ProjectFacts, text: string, actionsEnabled: boolean, timezone: string): Promise<StaffAnswer> {
  const clientId = actor.clientId as string;
  const loaded = await getWorkProject(actor, facts.projectId);
  if (!actionsEnabled) return actionsOff();
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
  const when = resolveNaturalDateTime(text, { timezone });
  const due = when?.iso ?? null;
  const title = /battery/i.test(text) ? "Check battery stock" : "Project task";
  const summary = `Create “${title}” on ${facts.number || facts.title}${name ? ` for ${name}` : ""}${when ? ` due ${when.localDate}${when.daypart ? ` ${when.daypart}` : ""}` : ""}. Nothing is saved until you approve.`;
  const id = await logAiAction({
    clientId,
    userId: actor.userId,
    toolName: "create_project_task",
    riskLevel: "WRITE_LOW",
    argumentsSummary: stripTenantArgs({ projectId: facts.projectId, title, assigneeId, dueAt: due }),
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: citations(facts), warnings: [], pendingActionId: id };
}

async function proposeFollowUp(actor: WorkProjectActor, facts: ProjectFacts, text: string, actionsEnabled: boolean, timezone: string): Promise<StaffAnswer> {
  if (!actionsEnabled) return actionsOff();
  const clientId = actor.clientId as string;
  const when = resolveNaturalDateTime(text, { timezone });
  const summary = `Schedule a sales follow-up for ${facts.contactName}${when ? ` on ${when.localDate}` : ""}. This does not create a project task. Nothing is saved until you approve.`;
  const id = await logAiAction({
    clientId,
    userId: actor.userId,
    toolName: "schedule_sales_follow_up",
    riskLevel: "WRITE_LOW",
    argumentsSummary: stripTenantArgs({ projectId: facts.projectId, dueAt: when?.iso ?? null }),
    resultSummary: summary,
    approvalRequired: true,
    status: "PENDING",
  });
  return { answer: summary, citations: ["Lead follow-up"], warnings: [], pendingActionId: id };
}

async function proposeSchedule(actor: WorkProjectActor, facts: ProjectFacts, text: string, timezone: string): Promise<StaffAnswer> {
  const readiness = installationReadinessAnswer(facts);
  if (!canManageWorkProjects(actor, actor.clientId || "")) {
    return { answer: "You don't have permission to schedule an installation.", citations: citations(facts), warnings: [], pendingActionId: null };
  }
  const when = resolveNaturalDateTime(text, { timezone });
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
    argumentsSummary: stripTenantArgs({ projectId: facts.projectId, startAt: when.iso, acknowledgeExceptions: facts.equipmentGaps.length > 0 }),
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
  const args = stripTenantArgs((data.arguments_summary || {}) as Record<string, unknown>);
  const tool = data.tool_name as string;
  if (!staffToolAllowed(tool)) return { ok: false as const, error: "That action is not available." };
  if (tool === "add_project_note") {
    const loaded = await getWorkProject(actor, String(args.projectId));
    if (!loaded.ok || !canUpdateWorkProject(actor, loaded.data.scope)) {
      return { ok: false as const, error: "You don't have permission to add a note on this project." };
    }
    const existing = String((loaded.data.project as { internal_notes?: string | null }).internal_notes || "");
    const line = `${new Date().toISOString().slice(0, 10)} — ${String(args.note || "").slice(0, 500)}`;
    const { error } = await supabase.from("work_projects").update({ internal_notes: `${existing}\n${line}`.trim() }).eq("id", args.projectId).eq("client_id", actor.clientId);
    if (error) {
      await supabase.from("ai_action_log").update({ status: "FAILED", result_summary: "I couldn't add the note." }).eq("id", actionId);
      return { ok: false as const, error: "I couldn't add the note." };
    }
  } else if (tool === "create_project_task") {
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
