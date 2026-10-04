import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEstate } from "@/lib/terminology";
import {
  canCancelOrReopenWorkProject,
  canCreateManualWorkProject,
  canManageWorkProjects,
  canReadWorkProject,
  canUpdateWorkProject,
  type WorkProjectActor,
} from "@/lib/work-projects/access";
import {
  canTransitionWorkProjectStatus,
  isWorkProjectPriority,
  isWorkProjectStatus,
  isWorkProjectWorkflow,
  type WorkProjectPriority,
  type WorkProjectStatus,
  type WorkProjectWorkflow,
} from "@/lib/work-projects/constants";
import { buildWorkProjectTitle, readSolarQuoteSnapshot, suggestWorkProjectWorkflow } from "@/lib/work-projects/draft";

export type { WorkProjectActor };

type DealSource = {
  id: string;
  client_id: string;
  contact_id: string | null;
  originating_lead_id: string;
  owner_id: string | null;
  stage: string;
  name: string;
  service_summary: string | null;
  location: string | null;
  won_value: number | null;
};

type LeadSource = {
  id: string;
  contact_id: string | null;
  source: string | null;
  project_type: string | null;
  customer_need: string | null;
  assigned_to_id: string | null;
  name: string | null;
};

type ContactSource = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  notes: string | null;
};

type QuoteSource = {
  id: string;
  quote_number: string | null;
  status: string;
  total: number | null;
  currency: string | null;
  accepted_at: string | null;
  revision_number: number | null;
  created_at: string;
  template_layout_key: string | null;
  template_fields: Record<string, unknown> | null;
  customer_name: string | null;
  deal_id: string | null;
  lead_id: string | null;
};

export type WorkProjectRow = {
  id: string;
  client_id: string;
  project_number: string;
  contact_id: string | null;
  lead_id: string | null;
  deal_id: string | null;
  quotation_id: string | null;
  title: string;
  description: string | null;
  project_type: string | null;
  workflow_key: WorkProjectWorkflow;
  status: WorkProjectStatus;
  project_value: number | null;
  currency: string;
  site_name: string | null;
  site_address: string | null;
  site_city: string | null;
  site_notes: string | null;
  project_owner_id: string | null;
  planned_start_date: string | null;
  scheduled_start_at: string | null;
  actual_start_at: string | null;
  target_completion_date: string | null;
  actual_completion_at: string | null;
  priority: WorkProjectPriority;
  customer_requirements: string | null;
  internal_notes: string | null;
  next_step: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  payment_required?: boolean;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): ServiceResult<never> {
  return { ok: false, status, error };
}

async function assertTradesClient(clientId: string): Promise<ServiceResult<{ name: string }>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return fail(404, "Company not found.");
  if (isRealEstate(data.business_type as string | null)) {
    return fail(404, "Projects are available for trades companies.");
  }
  return { ok: true, data: { name: (data.name as string) ?? "Company" } };
}

async function userInCompany(clientId: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return false;
  return data.role === "CLIENT_MANAGER" || data.role === "SALESPERSON" || data.role === "SUPER_ADMIN";
}

function pickQuotation(quotes: QuoteSource[]): QuoteSource | null {
  if (!quotes.length) return null;
  const accepted = quotes
    .filter((q) => q.status === "accepted")
    .sort((a, b) => (b.accepted_at ?? b.created_at).localeCompare(a.accepted_at ?? a.created_at));
  if (accepted[0]) return accepted[0];
  return [...quotes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

async function loadDealBundle(clientId: string, dealId: string) {
  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, client_id, contact_id, originating_lead_id, owner_id, stage, name, service_summary, location, won_value"
    )
    .eq("id", dealId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!deal) return null;
  const dealRow = deal as DealSource;
  const { data: lead } = await supabase
    .from("leads")
    .select("id, contact_id, source, project_type, customer_need, assigned_to_id, name")
    .eq("id", dealRow.originating_lead_id)
    .eq("client_id", clientId)
    .maybeSingle();
  const leadRow = (lead as LeadSource | null) ?? null;
  const contactId = dealRow.contact_id ?? leadRow?.contact_id ?? null;
  const { data: contact } = contactId
    ? await supabase
        .from("contacts")
        .select("id, name, phone, email, location, notes")
        .eq("id", contactId)
        .eq("client_id", clientId)
        .maybeSingle()
    : { data: null };
  const { data: quotes } = await supabase
    .from("quotations")
    .select(
      "id, quote_number, status, total, currency, accepted_at, revision_number, created_at, template_layout_key, template_fields, customer_name, deal_id, lead_id"
    )
    .eq("client_id", clientId)
    .or(`deal_id.eq.${dealId},lead_id.eq.${dealRow.originating_lead_id}`)
    .order("created_at", { ascending: false });
  return {
    deal: dealRow,
    lead: leadRow,
    contact: (contact as ContactSource | null) ?? null,
    quotes: (quotes ?? []) as QuoteSource[],
  };
}

export type WorkProjectDraft = {
  title: string;
  workflowKey: WorkProjectWorkflow;
  customerName: string;
  phone: string | null;
  email: string | null;
  siteAddress: string | null;
  projectValue: number | null;
  currency: string;
  quotation: {
    id: string;
    number: string | null;
    status: string;
    total: number | null;
    currency: string | null;
    acceptedAt: string | null;
    revision: number | null;
    accepted: boolean;
  } | null;
  solar: ReturnType<typeof readSolarQuoteSnapshot>;
  service: string | null;
  ownerId: string | null;
  contactId: string | null;
  leadId: string | null;
  dealId: string;
  existingProjectId: string | null;
};

export async function previewWorkProjectFromDeal(
  actor: WorkProjectActor,
  dealId: string
): Promise<ServiceResult<WorkProjectDraft>> {
  if (!actor.clientId) return fail(403, "Missing company.");
  const trades = await assertTradesClient(actor.clientId);
  if (!trades.ok) return trades;
  const bundle = await loadDealBundle(actor.clientId, dealId);
  if (!bundle) return fail(404, "Deal not found.");
  if (bundle.deal.stage !== "WON") return fail(409, "Create a project after the deal is won.");
  const allowed =
    canCreateManualWorkProject(actor, actor.clientId) ||
    (actor.role === "SALESPERSON" && bundle.deal.owner_id === actor.userId);
  if (!allowed) return fail(403, "You cannot create a project for this deal.");

  const quote = pickQuotation(bundle.quotes);
  const workflow = suggestWorkProjectWorkflow({
    templateLayoutKey: quote?.template_layout_key,
    projectType: bundle.lead?.project_type,
    serviceSummary: bundle.deal.service_summary,
    dealName: bundle.deal.name,
  });
  const customerName =
    bundle.contact?.name?.trim() ||
    quote?.customer_name?.trim() ||
    bundle.lead?.name?.trim() ||
    bundle.deal.name;
  const service = bundle.deal.service_summary?.trim() || bundle.lead?.project_type?.trim() || null;
  const solar = readSolarQuoteSnapshot(quote?.template_layout_key, quote?.template_fields);
  const siteAddress = solar?.siteAddress || bundle.deal.location || bundle.contact?.location || null;
  const existing = await findWorkProjectByDeal(actor.clientId, dealId);

  return {
    ok: true,
    data: {
      title: buildWorkProjectTitle({ customerName, service, workflow }),
      workflowKey: workflow,
      customerName,
      phone: bundle.contact?.phone ?? null,
      email: bundle.contact?.email ?? null,
      siteAddress,
      projectValue: bundle.deal.won_value != null ? Number(bundle.deal.won_value) : quote?.total ?? null,
      currency: quote?.currency || "USD",
      quotation: quote
        ? {
            id: quote.id,
            number: quote.quote_number,
            status: quote.status,
            total: quote.total,
            currency: quote.currency,
            acceptedAt: quote.accepted_at,
            revision: quote.revision_number,
            accepted: quote.status === "accepted",
          }
        : null,
      solar,
      service,
      ownerId: bundle.deal.owner_id,
      contactId: bundle.contact?.id ?? null,
      leadId: bundle.lead?.id ?? null,
      dealId: bundle.deal.id,
      existingProjectId: existing?.id ?? null,
    },
  };
}

async function findWorkProjectByDeal(clientId: string, dealId: string): Promise<WorkProjectRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("work_projects")
    .select("*")
    .eq("client_id", clientId)
    .eq("deal_id", dealId)
    .maybeSingle();
  return (data as WorkProjectRow | null) ?? null;
}

export async function findWorkProjectIdForDeal(
  clientId: string,
  dealId: string
): Promise<string | null> {
  try {
    const row = await findWorkProjectByDeal(clientId, dealId);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export async function createWorkProjectFromWonDeal(
  actor: WorkProjectActor,
  input: {
    dealId: string;
    workflowKey?: string | null;
    title?: string | null;
    ownerId?: string | null;
    targetCompletionDate?: string | null;
    scheduledStartAt?: string | null;
  }
): Promise<ServiceResult<{ project: WorkProjectRow; created: boolean }>> {
  const preview = await previewWorkProjectFromDeal(actor, input.dealId);
  if (!preview.ok) return preview;
  if (preview.data.existingProjectId) {
    const existing = await getWorkProject(actor, preview.data.existingProjectId);
    if (!existing.ok) return existing;
    return { ok: true, data: { project: existing.data.project, created: false } };
  }

  const workflow =
    input.workflowKey && isWorkProjectWorkflow(input.workflowKey)
      ? input.workflowKey
      : preview.data.workflowKey;
  const title = input.title?.trim() || preview.data.title;
  const ownerId = input.ownerId?.trim() || preview.data.ownerId;
  if (ownerId && !(await userInCompany(actor.clientId as string, ownerId))) {
    return fail(400, "Owner must belong to this company.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("insert_work_project", {
    p_payload: {
      client_id: actor.clientId,
      contact_id: preview.data.contactId,
      lead_id: preview.data.leadId,
      deal_id: preview.data.dealId,
      quotation_id: preview.data.quotation?.id ?? null,
      title,
      description: preview.data.service,
      project_type: preview.data.service,
      workflow_key: workflow,
      project_value: preview.data.projectValue,
      currency: preview.data.currency,
      site_address: preview.data.siteAddress,
      project_owner_id: ownerId,
      target_completion_date: input.targetCompletionDate || null,
      scheduled_start_at: input.scheduledStartAt || null,
      priority: "NORMAL",
      customer_requirements: preview.data.service,
      created_by: actor.userId,
    },
  });
  if (error || !data) return fail(500, "Could not create the project.");
  const payload = data as { id?: string; created?: boolean };
  if (!payload.id) return fail(500, "Could not create the project.");
  const loaded = await getWorkProject(actor, payload.id);
  if (!loaded.ok) return loaded;
  return { ok: true, data: { project: loaded.data.project, created: payload.created !== false } };
}

export async function createManualWorkProject(
  actor: WorkProjectActor,
  input: {
    contactId: string;
    title: string;
    workflowKey: string;
    dealId?: string | null;
    quotationId?: string | null;
    siteName?: string | null;
    siteAddress?: string | null;
    siteCity?: string | null;
    siteNotes?: string | null;
    projectValue?: number | null;
    currency?: string | null;
    plannedStartDate?: string | null;
    scheduledStartAt?: string | null;
    targetCompletionDate?: string | null;
    ownerId?: string | null;
    customerRequirements?: string | null;
    priority?: string | null;
    projectType?: string | null;
    description?: string | null;
  }
): Promise<ServiceResult<{ project: WorkProjectRow; created: boolean }>> {
  if (!actor.clientId) return fail(403, "Missing company.");
  if (!canCreateManualWorkProject(actor, actor.clientId)) {
    return fail(403, "Only a manager can create a project directly.");
  }
  const trades = await assertTradesClient(actor.clientId);
  if (!trades.ok) return trades;
  if (!isWorkProjectWorkflow(input.workflowKey)) return fail(400, "Choose a project workflow.");
  const title = input.title.trim();
  if (!title) return fail(400, "Enter a project title.");

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, location")
    .eq("id", input.contactId)
    .eq("client_id", actor.clientId)
    .maybeSingle();
  if (!contact) return fail(400, "Customer not found in this company.");

  let leadId: string | null = null;
  if (input.dealId) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id, client_id, contact_id, originating_lead_id, stage")
      .eq("id", input.dealId)
      .eq("client_id", actor.clientId)
      .maybeSingle();
    if (!deal) return fail(400, "Deal not found in this company.");
    if (deal.contact_id && deal.contact_id !== input.contactId) {
      return fail(400, "That deal belongs to a different customer.");
    }
    leadId = (deal.originating_lead_id as string) ?? null;
    const existing = await findWorkProjectByDeal(actor.clientId, input.dealId);
    if (existing) return { ok: true, data: { project: existing, created: false } };
  }

  if (input.quotationId) {
    const { data: quote } = await supabase
      .from("quotations")
      .select("id, client_id, deal_id, lead_id")
      .eq("id", input.quotationId)
      .eq("client_id", actor.clientId)
      .maybeSingle();
    if (!quote) return fail(400, "Quotation not found in this company.");
    if (input.dealId && quote.deal_id && quote.deal_id !== input.dealId) {
      return fail(400, "That quotation belongs to a different deal.");
    }
    if (leadId && quote.lead_id && quote.lead_id !== leadId && quote.deal_id !== input.dealId) {
      return fail(400, "That quotation does not belong to this customer record.");
    }
  }

  if (input.ownerId && !(await userInCompany(actor.clientId, input.ownerId))) {
    return fail(400, "Owner must belong to this company.");
  }
  if (input.projectValue != null && (!Number.isFinite(input.projectValue) || input.projectValue < 0)) {
    return fail(400, "Enter a valid project value.");
  }
  const priority = input.priority && isWorkProjectPriority(input.priority) ? input.priority : "NORMAL";

  const { data, error } = await supabase.rpc("insert_work_project", {
    p_payload: {
      client_id: actor.clientId,
      contact_id: input.contactId,
      lead_id: leadId,
      deal_id: input.dealId || null,
      quotation_id: input.quotationId || null,
      title,
      description: input.description || null,
      project_type: input.projectType || null,
      workflow_key: input.workflowKey,
      project_value: input.projectValue ?? null,
      currency: input.currency || "USD",
      site_name: input.siteName || null,
      site_address: input.siteAddress || (contact.location as string | null) || null,
      site_city: input.siteCity || null,
      site_notes: input.siteNotes || null,
      project_owner_id: input.ownerId || null,
      planned_start_date: input.plannedStartDate || null,
      scheduled_start_at: input.scheduledStartAt || null,
      target_completion_date: input.targetCompletionDate || null,
      priority,
      customer_requirements: input.customerRequirements || null,
      created_by: actor.userId,
    },
  });
  if (error || !data) return fail(500, "Could not create the project.");
  const payload = data as { id?: string; created?: boolean };
  if (!payload.id) return fail(500, "Could not create the project.");
  const loaded = await getWorkProject(actor, payload.id);
  if (!loaded.ok) return loaded;
  return { ok: true, data: { project: loaded.data.project, created: payload.created !== false } };
}

async function accessRow(project: WorkProjectRow) {
  const supabase = createAdminClient();
  const [{ data: members }, { data: deal }] = await Promise.all([
    supabase.from("work_project_members").select("user_id").eq("project_id", project.id),
    project.deal_id
      ? supabase.from("deals").select("owner_id").eq("id", project.deal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    client_id: project.client_id,
    project_owner_id: project.project_owner_id,
    deal_owner_id: (deal?.owner_id as string | null) ?? null,
    member_user_ids: ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
    status: project.status,
  };
}

export async function getWorkProject(actor: WorkProjectActor, projectId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("work_projects").select("*").eq("id", projectId).maybeSingle();
  if (!data) return fail(404, "Project not found.");
  const project = data as WorkProjectRow;
  const scope = await accessRow(project);
  if (!canReadWorkProject(actor, scope)) return fail(404, "Project not found.");
  return { ok: true as const, data: { project, scope } };
}

export async function listWorkProjects(
  actor: WorkProjectActor,
  filters: {
    status?: string | null;
    ownerId?: string | null;
    workflow?: string | null;
    q?: string | null;
    from?: string | null;
    to?: string | null;
  }
) {
  if (!actor.clientId) return fail(403, "Missing company.");
  const trades = await assertTradesClient(actor.clientId);
  if (!trades.ok) return trades;
  if (actor.role !== "CLIENT_MANAGER" && actor.role !== "SUPER_ADMIN" && actor.role !== "SALESPERSON") {
    return fail(403, "You cannot view projects.");
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("work_projects")
    .select("*")
    .eq("client_id", actor.clientId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filters.status && isWorkProjectStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.ownerId) query = query.eq("project_owner_id", filters.ownerId);
  if (filters.workflow && isWorkProjectWorkflow(filters.workflow)) query = query.eq("workflow_key", filters.workflow);
  if (filters.from) query = query.gte("target_completion_date", filters.from);
  if (filters.to) query = query.lte("target_completion_date", filters.to);

  const { data, error } = await query;
  if (error) return fail(500, "Could not load projects.");
  let rows = (data ?? []) as WorkProjectRow[];

  if (actor.role === "SALESPERSON") {
    const ids = rows.map((r) => r.id);
    const dealIds = rows.map((r) => r.deal_id).filter(Boolean) as string[];
    const [{ data: members }, { data: deals }] = await Promise.all([
      ids.length
        ? supabase.from("work_project_members").select("project_id, user_id").in("project_id", ids)
        : Promise.resolve({ data: [] }),
      dealIds.length
        ? supabase.from("deals").select("id, owner_id").in("id", dealIds)
        : Promise.resolve({ data: [] }),
    ]);
    const memberByProject = new Map<string, string[]>();
    for (const member of (members ?? []) as Array<{ project_id: string; user_id: string }>) {
      const list = memberByProject.get(member.project_id) ?? [];
      list.push(member.user_id);
      memberByProject.set(member.project_id, list);
    }
    const dealOwner = new Map(
      ((deals ?? []) as Array<{ id: string; owner_id: string | null }>).map((d) => [d.id, d.owner_id])
    );
    rows = rows.filter((row) =>
      canReadWorkProject(actor, {
        client_id: row.client_id,
        project_owner_id: row.project_owner_id,
        deal_owner_id: row.deal_id ? dealOwner.get(row.deal_id) ?? null : null,
        member_user_ids: memberByProject.get(row.id) ?? [],
        status: row.status,
      })
    );
  }

  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(rows.map((r) => r.project_owner_id).filter(Boolean))] as string[];
  const [{ data: contacts }, { data: owners }] = await Promise.all([
    contactIds.length
      ? supabase.from("contacts").select("id, name, phone").in("id", contactIds).eq("client_id", actor.clientId)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? supabase.from("users").select("id, name").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const contactById = new Map(
    ((contacts ?? []) as Array<{ id: string; name: string | null; phone: string | null }>).map((c) => [c.id, c])
  );
  const ownerById = new Map(
    ((owners ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, u.name])
  );

  const q = filters.q?.trim().toLowerCase();
  const items = rows
    .map((project) => {
      const contact = project.contact_id ? contactById.get(project.contact_id) : undefined;
      return {
        project,
        customerName: contact?.name ?? null,
        customerPhone: contact?.phone ?? null,
        ownerName: project.project_owner_id ? ownerById.get(project.project_owner_id) ?? null : null,
      };
    })
    .filter((item) => {
      if (!q) return true;
      const hay = [
        item.project.project_number,
        item.project.title,
        item.customerName,
        item.customerPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

  return { ok: true as const, data: items };
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
  await supabase
    .from("work_projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", opts.projectId)
    .eq("client_id", opts.clientId);
}

export async function updateWorkProjectMetadata(
  actor: WorkProjectActor,
  projectId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    projectType: string | null;
    workflowKey: string;
    priority: string;
    projectValue: number | null;
    currency: string;
    siteName: string | null;
    siteAddress: string | null;
    siteCity: string | null;
    siteNotes: string | null;
    plannedStartDate: string | null;
    scheduledStartAt: string | null;
    targetCompletionDate: string | null;
    customerRequirements: string | null;
    internalNotes: string | null;
    nextStep: string | null;
    ownerId: string | null;
  }>
) {
  const loaded = await getWorkProject(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canUpdateWorkProject(actor, loaded.data.scope)) return fail(403, "You cannot update this project.");
  const project = loaded.data.project;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title != null) {
    const title = patch.title.trim();
    if (!title) return fail(400, "Enter a project title.");
    updates.title = title;
  }
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.projectType !== undefined) updates.project_type = patch.projectType;
  if (patch.workflowKey != null) {
    if (!isWorkProjectWorkflow(patch.workflowKey)) return fail(400, "Unknown workflow.");
    updates.workflow_key = patch.workflowKey;
  }
  if (patch.priority != null) {
    if (!isWorkProjectPriority(patch.priority)) return fail(400, "Unknown priority.");
    updates.priority = patch.priority;
  }
  if (patch.projectValue !== undefined) {
    if (!canManageWorkProjects(actor, project.client_id)) {
      return fail(403, "Only a manager can change the project value.");
    }
    if (patch.projectValue != null && (!Number.isFinite(patch.projectValue) || patch.projectValue < 0)) {
      return fail(400, "Enter a valid project value.");
    }
    updates.project_value = patch.projectValue;
  }
  if (patch.currency != null) updates.currency = patch.currency.trim() || "USD";
  if (patch.siteName !== undefined) updates.site_name = patch.siteName;
  if (patch.siteAddress !== undefined) updates.site_address = patch.siteAddress;
  if (patch.siteCity !== undefined) updates.site_city = patch.siteCity;
  if (patch.siteNotes !== undefined) updates.site_notes = patch.siteNotes;
  if (patch.plannedStartDate !== undefined) updates.planned_start_date = patch.plannedStartDate;
  if (patch.scheduledStartAt !== undefined) updates.scheduled_start_at = patch.scheduledStartAt;
  if (patch.targetCompletionDate !== undefined) updates.target_completion_date = patch.targetCompletionDate;
  if (patch.customerRequirements !== undefined) updates.customer_requirements = patch.customerRequirements;
  if (patch.internalNotes !== undefined) updates.internal_notes = patch.internalNotes;
  if (patch.nextStep !== undefined) updates.next_step = patch.nextStep;

  let ownerChanged = false;
  if (patch.ownerId !== undefined && patch.ownerId !== project.project_owner_id) {
    if (!canCancelOrReopenWorkProject(actor, project.client_id)) {
      return fail(403, "Only a manager can change the project owner.");
    }
    if (patch.ownerId && !(await userInCompany(project.client_id, patch.ownerId))) {
      return fail(400, "Owner must belong to this company.");
    }
    updates.project_owner_id = patch.ownerId;
    ownerChanged = true;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("work_projects")
    .update(updates)
    .eq("id", project.id)
    .eq("client_id", project.client_id);
  if (error) return fail(500, "Could not update the project.");

  if (ownerChanged) {
    if (project.project_owner_id) {
      await supabase
        .from("work_project_members")
        .update({ project_role: "MEMBER" })
        .eq("project_id", project.id)
        .eq("user_id", project.project_owner_id);
    }
    if (patch.ownerId) {
      await supabase.from("work_project_members").upsert(
        {
          client_id: project.client_id,
          project_id: project.id,
          user_id: patch.ownerId,
          project_role: "OWNER",
        },
        { onConflict: "project_id,user_id" }
      );
    }
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "OWNER_CHANGED",
      title: "Owner changed",
      metadata: { from: project.project_owner_id, to: patch.ownerId },
    });
  }
  if (patch.projectValue !== undefined && patch.projectValue !== project.project_value) {
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "PROJECT_VALUE_CHANGED",
      title: "Project value changed",
      metadata: { from: project.project_value, to: patch.projectValue },
    });
  }
  if (patch.priority && patch.priority !== project.priority) {
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "PRIORITY_CHANGED",
      title: "Priority changed",
      metadata: { from: project.priority, to: patch.priority },
    });
  }
  if (
    patch.plannedStartDate !== undefined ||
    patch.scheduledStartAt !== undefined ||
    patch.targetCompletionDate !== undefined
  ) {
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "SCHEDULE_CHANGED",
      title: "Schedule changed",
      metadata: {
        planned_start_date: patch.plannedStartDate,
        scheduled_start_at: patch.scheduledStartAt,
        target_completion_date: patch.targetCompletionDate,
      },
    });
  }
  if (patch.customerRequirements !== undefined && patch.customerRequirements !== project.customer_requirements) {
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "CUSTOMER_REQUIREMENT_UPDATED",
      title: "Customer requirements updated",
    });
  }
  const detailKeys = ["title", "description", "workflowKey", "siteAddress", "projectValue", "nextStep"] as const;
  if (detailKeys.some((key) => patch[key] !== undefined)) {
    await writeEvent({
      clientId: project.client_id,
      projectId: project.id,
      actorId: actor.userId,
      eventType: "DETAILS_UPDATED",
      title: "Project details updated",
    });
  }

  return getWorkProject(actor, projectId);
}

export async function updateWorkProjectStatus(
  actor: WorkProjectActor,
  projectId: string,
  status: string,
  reason?: string | null
) {
  if (!isWorkProjectStatus(status)) return fail(400, "Unknown project status.");
  const loaded = await getWorkProject(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  const reopening = project.status === "COMPLETED" || project.status === "CANCELLED";
  if (reopening || status === "CANCELLED") {
    if (!canCancelOrReopenWorkProject(actor, project.client_id)) {
      return fail(403, reopening ? "Only a manager can reopen a project." : "Only a manager can cancel a project.");
    }
  } else if (!canUpdateWorkProject(actor, loaded.data.scope)) {
    return fail(403, "You cannot update this project.");
  }
  if (status === "CANCELLED" && !reason?.trim()) return fail(400, "A cancellation reason is required.");
  if (
    !canTransitionWorkProjectStatus(project.status, status, {
      allowReopen: canCancelOrReopenWorkProject(actor, project.client_id),
    })
  ) {
    return fail(400, "That status change is not allowed.");
  }
  if (status === "COMPLETED") {
    const { projectCompletionGate } = await import("@/lib/work-projects/installation-service");
    const gate = await projectCompletionGate(actor, projectId);
    if (!gate.ok) return gate;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("set_work_project_status", {
    p_client_id: project.client_id,
    p_project_id: project.id,
    p_status: status,
    p_actor_id: actor.userId,
    p_reason: reason?.trim() || null,
  });
  if (error || !data || (data as { ok?: boolean }).ok === false) {
    return fail(500, "Could not update the project status.");
  }
  return getWorkProject(actor, projectId);
}

export async function addWorkProjectNote(actor: WorkProjectActor, projectId: string, content: string) {
  const loaded = await getWorkProject(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canUpdateWorkProject(actor, loaded.data.scope)) return fail(403, "You cannot add a note.");
  const text = content.trim();
  if (!text) return fail(400, "Write a note.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "NOTE_ADDED",
    title: "Note",
    description: text,
  });
  return { ok: true as const, data: { saved: true } };
}

export async function loadWorkProjectWorkspace(actor: WorkProjectActor, projectId: string) {
  const loaded = await getWorkProject(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  const supabase = createAdminClient();
  const [{ data: events }, { data: contact }, { data: owner }, { data: lead }, { data: deal }, { data: quote }] =
    await Promise.all([
      supabase
        .from("work_project_events")
        .select("id, event_type, title, description, actor_user_id, metadata, created_at")
        .eq("project_id", project.id)
        .eq("client_id", project.client_id)
        .order("created_at", { ascending: false })
        .limit(100),
      project.contact_id
        ? supabase
            .from("contacts")
            .select("id, name, phone, email, location, notes")
            .eq("id", project.contact_id)
            .eq("client_id", project.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      project.project_owner_id
        ? supabase.from("users").select("id, name").eq("id", project.project_owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      project.lead_id
        ? supabase
            .from("leads")
            .select("id, name, source, project_type, customer_need, assigned_to_id")
            .eq("id", project.lead_id)
            .eq("client_id", project.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      project.deal_id
        ? supabase
            .from("deals")
            .select("id, name, stage, won_value, won_at, owner_id, service_summary, location")
            .eq("id", project.deal_id)
            .eq("client_id", project.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      project.quotation_id
        ? supabase
            .from("quotations")
            .select(
              "id, quote_number, status, total, currency, accepted_at, revision_number, template_layout_key, template_fields, pdf_url"
            )
            .eq("id", project.quotation_id)
            .eq("client_id", project.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const actorIds = [
    ...new Set(
      ((events ?? []) as Array<{ actor_user_id: string | null }>).map((e) => e.actor_user_id).filter(Boolean)
    ),
  ] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("users").select("id, name").in("id", actorIds)
    : { data: [] };
  const actorNames = new Map(
    ((actors ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, u.name])
  );

  let salespersonName: string | null = null;
  const salespersonId = (deal?.owner_id as string | null) ?? (lead?.assigned_to_id as string | null) ?? null;
  if (salespersonId) {
    const { data: salesperson } = await supabase.from("users").select("name").eq("id", salespersonId).maybeSingle();
    salespersonName = (salesperson?.name as string | null) ?? null;
  }

  return {
    ok: true as const,
    data: {
      project,
      contact: contact ?? null,
      ownerName: (owner?.name as string | null) ?? null,
      lead: lead ?? null,
      deal: deal ?? null,
      quotation: quote ?? null,
      solar: readSolarQuoteSnapshot(
        (quote?.template_layout_key as string | null) ?? null,
        (quote?.template_fields as Record<string, unknown> | null) ?? null
      ),
      salespersonName,
      events: ((events ?? []) as Array<{
        id: string;
        event_type: string;
        title: string;
        description: string | null;
        actor_user_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>).map((event) => ({
        ...event,
        actorName: event.actor_user_id ? actorNames.get(event.actor_user_id) ?? null : null,
      })),
    },
  };
}

export async function searchWorkProjectContacts(actor: WorkProjectActor, query: string) {
  if (!actor.clientId || !canCreateManualWorkProject(actor, actor.clientId)) {
    return fail(403, "Only a manager can search customers for a new project.");
  }
  const q = query.trim().replace(/[%_,.()]/g, "");
  if (q.length < 2) return { ok: true as const, data: [] as Array<{ id: string; name: string | null; phone: string | null }> };
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("client_id", actor.clientId)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(12);
  return { ok: true as const, data: (data ?? []) as Array<{ id: string; name: string | null; phone: string | null }> };
}

export async function loadWorkProjectSummary(clientId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_projects")
    .select("status, completed_at, actual_completion_at")
    .eq("client_id", clientId);
  if (error) return null;
  const rows = (data ?? []) as Array<{
    status: string;
    completed_at: string | null;
    actual_completion_at: string | null;
  }>;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const completedThisMonth = rows.filter((row) => {
    if (row.status !== "COMPLETED") return false;
    const stamp = row.actual_completion_at || row.completed_at;
    return Boolean(stamp) && new Date(stamp as string).getTime() >= monthStart.getTime();
  }).length;
  return {
    active: rows.filter((row) => row.status !== "COMPLETED" && row.status !== "CANCELLED").length,
    scheduled: rows.filter((row) => row.status === "SCHEDULED").length,
    inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    awaitingCustomer: rows.filter((row) => row.status === "AWAITING_CUSTOMER").length,
    onHold: rows.filter((row) => row.status === "ON_HOLD").length,
    completedThisMonth,
  };
}
