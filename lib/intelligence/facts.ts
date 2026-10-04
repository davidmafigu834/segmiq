import { createAdminClient } from "@/lib/supabase/admin";
import { paymentGate, termAmount } from "@/lib/work-projects/commercial-rules";
import { canReadWorkProject, type WorkProjectActor } from "@/lib/work-projects/access";
import { getWorkProject } from "@/lib/work-projects/service";
import type { AttentionItem, ProjectFacts } from "@/lib/intelligence/rules";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function loadProjectFacts(actor: WorkProjectActor, projectId: string): Promise<ProjectFacts | null> {
  if (!actor.clientId) return null;
  const loaded = await getWorkProject(actor, projectId);
  if (!loaded.ok) return null;
  if (!canReadWorkProject(actor, loaded.data.scope)) return null;
  const project = loaded.data.project;
  const clientId = actor.clientId;
  const supabase = createAdminClient();
  const [contactRes, paymentsRes, termsRes, equipmentRes, visitsRes, assessmentRes, installationRes, qaRes, commissioningRes, handoverRes] = await Promise.all([
    project.contact_id
      ? supabase.from("contacts").select("name").eq("id", project.contact_id).eq("client_id", clientId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("work_project_payments").select("amount, status, payment_term_id").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_payment_terms").select("id, term_type, percent, amount, trigger_type").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_equipment").select("description, quantity_required, quantity_reserved, quantity_issued, track_inventory, cancelled").eq("project_id", projectId).eq("client_id", clientId),
    supabase.from("work_project_visits").select("id, status, visit_type").eq("project_id", projectId).eq("client_id", clientId).eq("visit_type", "SITE_ASSESSMENT").eq("status", "COMPLETED"),
    supabase.from("work_project_visit_assessments").select("summary, status").eq("project_id", projectId).eq("client_id", clientId).eq("status", "COMPLETED").limit(1),
    supabase.from("work_project_installations").select("status, scheduled_start_at, site_name, site_address").eq("project_id", projectId).eq("client_id", clientId).neq("status", "CANCELLED").order("created_at", { ascending: false }).limit(1),
    supabase.from("work_project_quality_checks").select("outcome").eq("project_id", projectId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
    supabase.from("work_project_commissioning").select("status, commissioned_at").eq("project_id", projectId).eq("client_id", clientId).eq("status", "COMPLETED").limit(1),
    supabase.from("work_project_handovers").select("status, handover_at").eq("project_id", projectId).eq("client_id", clientId).eq("status", "COMPLETED").limit(1),
  ]);
  const confirmed = (paymentsRes.data ?? []).filter((row) => row.status === "CONFIRMED");
  const pending = (paymentsRes.data ?? []).filter((row) => row.status === "PENDING");
  const value = project.project_value == null ? null : num(project.project_value);
  const paid = Math.round(confirmed.reduce((sum, row) => sum + num(row.amount), 0) * 100) / 100;
  const terms = (termsRes.data ?? []).map((term) => ({
    id: term.id as string,
    trigger: term.trigger_type as string,
    termType: term.term_type as "PERCENTAGE" | "FIXED_AMOUNT",
    percent: term.percent as number | null,
    amount: term.amount as number | null,
  }));
  const byTerm = new Map<string, number>();
  let unallocated = 0;
  for (const row of confirmed) {
    if (row.payment_term_id) byTerm.set(row.payment_term_id as string, (byTerm.get(row.payment_term_id as string) ?? 0) + num(row.amount));
    else unallocated += num(row.amount);
  }
  const gate = paymentGate({ projectValue: value, terms, confirmedByTerm: byTerm, unallocatedConfirmed: unallocated });
  const gaps = (equipmentRes.data ?? [])
    .filter((row) => row.track_inventory && !row.cancelled)
    .map((row) => ({
      description: String(row.description || "item"),
      missing: Math.max(0, num(row.quantity_required) - num(row.quantity_reserved) - num(row.quantity_issued)),
    }))
    .filter((row) => row.missing > 0);
  const installation = installationRes.data?.[0];
  const site = [installation?.site_name || project.site_name, installation?.site_address || project.site_address].filter(Boolean).join(", ") || null;
  return {
    projectId,
    number: (project.project_number as string | null) ?? null,
    title: project.title as string,
    contactName: (contactRes.data?.name as string | null) || "Customer",
    site,
    projectValue: value,
    currency: (project.currency as string) || "USD",
    confirmedPaid: paid,
    pendingAmount: Math.round(pending.reduce((sum, row) => sum + num(row.amount), 0) * 100) / 100,
    outstanding: value == null ? null : Math.max(0, Math.round((value - paid) * 100) / 100),
    depositSatisfied: gate.configured ? gate.satisfied : paid > 0 || !project.payment_required,
    assessmentCompleted: (visitsRes.data ?? []).length > 0,
    assessmentSummary: (assessmentRes.data?.[0]?.summary as string | null) ?? null,
    equipmentGaps: gaps,
    installationScheduledAt: (installation?.scheduled_start_at as string | null) ?? null,
    installationStatus: (installation?.status as string | null) ?? null,
    qaOutcome: (qaRes.data?.[0]?.outcome as string | null) ?? null,
    commissioningCompleted: Boolean(commissioningRes.data?.[0]),
    commissioningAt: (commissioningRes.data?.[0]?.commissioned_at as string | null) ?? null,
    handoverCompleted: Boolean(handoverRes.data?.[0]),
    handoverAt: (handoverRes.data?.[0]?.handover_at as string | null) ?? null,
  };
}

export async function resolveProjectsByName(actor: WorkProjectActor, name: string): Promise<Array<{ projectId: string; label: string }>> {
  if (!actor.clientId) return [];
  const supabase = createAdminClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("client_id", actor.clientId)
    .ilike("name", `%${name.trim()}%`)
    .limit(8);
  const ids = (contacts ?? []).map((row) => row.id as string);
  if (!ids.length) return [];
  const { data: projects } = await supabase
    .from("work_projects")
    .select("id, title, project_number, contact_id, status")
    .eq("client_id", actor.clientId)
    .in("contact_id", ids)
    .neq("status", "CANCELLED")
    .limit(8);
  const names = new Map((contacts ?? []).map((row) => [row.id as string, row.name as string]));
  const matches = [];
  for (const project of projects ?? []) {
    const loaded = await getWorkProject(actor, project.id as string);
    if (!loaded.ok || !canReadWorkProject(actor, loaded.data.scope)) continue;
    matches.push({
      projectId: project.id as string,
      label: `${names.get(project.contact_id as string) || "Customer"} — ${project.project_number || project.title}`,
    });
  }
  return matches;
}

export async function listOperationsAttention(actor: WorkProjectActor): Promise<AttentionItem[]> {
  if (!actor.clientId) return [];
  const supabase = createAdminClient();
  const { data: projects } = await supabase
    .from("work_projects")
    .select("id, title, project_number, status")
    .eq("client_id", actor.clientId)
    .not("status", "in", "(COMPLETED,CANCELLED)")
    .limit(40);
  const visible = [];
  for (const project of projects ?? []) {
    const loaded = await getWorkProject(actor, project.id as string);
    if (loaded.ok && canReadWorkProject(actor, loaded.data.scope)) visible.push(project);
  }
  const ids = visible.map((row) => row.id as string);
  if (!ids.length) return [];
  const [payments, equipment, qa, installations, support] = await Promise.all([
    supabase.from("work_project_payments").select("project_id, amount").eq("client_id", actor.clientId).eq("status", "PENDING").in("project_id", ids),
    supabase.from("work_project_equipment").select("project_id, description, quantity_required, quantity_reserved, quantity_issued, track_inventory, cancelled").eq("client_id", actor.clientId).in("project_id", ids),
    supabase.from("work_project_quality_checks").select("project_id, outcome, created_at").eq("client_id", actor.clientId).in("project_id", ids).order("created_at", { ascending: false }),
    supabase.from("work_project_installations").select("project_id, status").eq("client_id", actor.clientId).in("project_id", ids).neq("status", "CANCELLED"),
    supabase.from("support_cases").select("id, status, work_project_id").eq("client_id", actor.clientId).in("status", ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"]).limit(20),
  ]);
  const items: AttentionItem[] = [];
  const title = new Map(visible.map((row) => [row.id as string, `${row.project_number || row.title}`]));
  for (const row of payments.data ?? []) {
    items.push({ kind: "PAYMENT_PROOF", title: title.get(row.project_id as string) || "Project", detail: "Payment proof waiting for confirmation", projectId: row.project_id as string });
  }
  for (const row of equipment.data ?? []) {
    if (!row.track_inventory || row.cancelled) continue;
    const missing = num(row.quantity_required) - num(row.quantity_reserved) - num(row.quantity_issued);
    if (missing > 0) items.push({ kind: "STOCK", title: title.get(row.project_id as string) || "Project", detail: `${missing} ${row.description} still missing`, projectId: row.project_id as string });
  }
  const latestQa = new Map<string, string>();
  for (const row of qa.data ?? []) {
    if (!latestQa.has(row.project_id as string)) latestQa.set(row.project_id as string, row.outcome as string);
  }
  for (const [projectId, outcome] of latestQa) {
    if (outcome === "REQUIRES_REWORK") items.push({ kind: "QA", title: title.get(projectId) || "Project", detail: "Latest quality check requires rework", projectId });
  }
  for (const row of installations.data ?? []) {
    if (row.status === "QA_PENDING") items.push({ kind: "QA", title: title.get(row.project_id as string) || "Project", detail: "Physical work is complete and quality check is still open", projectId: row.project_id as string });
    if (row.status === "COMMISSIONING_PENDING") items.push({ kind: "COMMISSIONING", title: title.get(row.project_id as string) || "Project", detail: "Waiting for commissioning", projectId: row.project_id as string });
    if (row.status === "HANDOVER_PENDING") items.push({ kind: "HANDOVER", title: title.get(row.project_id as string) || "Project", detail: "Waiting for handover", projectId: row.project_id as string });
  }
  for (const row of support.data ?? []) {
    items.push({ kind: "SUPPORT", title: "Support", detail: `Case ${row.status}`, projectId: (row.work_project_id as string | null) || undefined });
  }
  return items;
}
