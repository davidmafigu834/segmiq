import { createAdminClient } from "@/lib/supabase/admin";
import { createManualDocumentLink } from "@/lib/documents/linking/store";
import { canManageWorkProjects, canReadWorkProject, type WorkProjectActor } from "@/lib/work-projects/access";
import {
  commercialAttention,
  equipmentLineStatus,
  moneyRound,
  outstandingBalance,
  paymentGate,
  PAYMENT_METHODS,
  PAYMENT_TRIGGERS,
  projectPaymentStatus,
  quantityMissing,
  quoteScheduleTerm,
  readinessSummary,
  termAmount,
  type ProjectPaymentStatus,
} from "@/lib/work-projects/commercial-rules";
import { getWorkProject, type ServiceResult } from "@/lib/work-projects/service";

function fail(status: number, error: string): ServiceResult<never> {
  return { ok: false, status, error };
}

async function scoped(actor: WorkProjectActor, projectId: string) {
  if (!actor.clientId) return fail(403, "Missing company.");
  return getWorkProject(actor, projectId);
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

type TermRow = {
  id: string;
  project_id?: string;
  label: string;
  term_type: "PERCENTAGE" | "FIXED_AMOUNT";
  percent: number | null;
  amount: number | null;
  trigger_type: string;
  due_date: string | null;
  sequence: number;
};

type PaymentRow = {
  id: string;
  payment_term_id: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  reference: string | null;
  paid_at: string;
  status: string;
  notes: string | null;
  proofCount?: number;
};

type EquipmentRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  description: string;
  quantity_required: number;
  quantity_reserved: number;
  quantity_issued: number;
  unit: string | null;
  track_inventory: boolean;
  source_quotation_line_id: string | null;
  source_quantity: number | null;
  notes: string | null;
  cancelled: boolean;
};

export type ProjectCommercialSnapshot = {
  canManage: boolean;
  currency: string;
  projectValue: number | null;
  paymentRequired: boolean;
  received: number;
  outstanding: number | null;
  paymentStatus: ProjectPaymentStatus;
  gate: { configured: boolean; required: number; received: number; satisfied: boolean };
  terms: Array<{
    id: string;
    label: string;
    termType: string;
    percent: number | null;
    amount: number | null;
    resolvedAmount: number;
    trigger: string;
    dueDate: string | null;
    paid: number;
    satisfied: boolean;
    overdue: boolean;
  }>;
  payments: PaymentRow[];
  equipment: Array<{
    id: string;
    description: string;
    productId: string | null;
    required: number;
    reserved: number;
    issued: number;
    missing: number;
    available: number;
    unit: string | null;
    tracked: boolean;
    status: string;
    supplierName: string | null;
    supplierSku: string | null;
    leadTimeDays: number | null;
    cost: number | null;
    differs: boolean;
  }>;
  readiness: ReturnType<typeof readinessSummary>;
  attention: string[];
  quoteDiffers: boolean;
  locations: Array<{ id: string; name: string }>;
  assessmentCompleted: boolean;
};

export async function loadProjectCommercial(actor: WorkProjectActor, projectId: string): Promise<ServiceResult<ProjectCommercialSnapshot>> {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  const project = loaded.data.project;
  const supabase = createAdminClient();
  const isManager = canManageWorkProjects(actor, project.client_id);
  const [{ data: terms }, { data: payments }, { data: equipmentData }, { data: assessments }, { data: locations }, { data: links }] = await Promise.all([
    supabase.from("work_project_payment_terms").select("*").eq("project_id", projectId).eq("client_id", project.client_id).order("sequence"),
    supabase.from("work_project_payments").select("*").eq("project_id", projectId).eq("client_id", project.client_id).order("paid_at", { ascending: false }),
    supabase.from("work_project_equipment").select("*").eq("project_id", projectId).eq("client_id", project.client_id).order("created_at"),
    supabase.from("work_project_visit_assessments").select("status").eq("project_id", projectId).eq("client_id", project.client_id).eq("status", "COMPLETED").limit(1),
    supabase.from("inventory_locations").select("id, name").eq("client_id", project.client_id).order("name"),
    supabase.from("document_entity_links").select("entity_id").eq("client_id", project.client_id).eq("entity_type", "WORK_PROJECT_PAYMENT"),
  ]);
  const termRows = (terms ?? []) as TermRow[];
  const paymentRows = (payments ?? []) as PaymentRow[];
  const equipmentRows = (equipmentData ?? []) as EquipmentRow[];
  const productIds = equipmentRows.map((row) => row.product_id).filter(Boolean) as string[];
  const [{ data: products }, { data: balances }, { data: released }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, preferred_supplier_name, supplier_sku, lead_time_days, cost_price").in("id", productIds).eq("client_id", project.client_id)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase.from("inventory_balances").select("product_id, variant_id, on_hand, reserved").in("product_id", productIds).eq("client_id", project.client_id)
      : Promise.resolve({ data: [] }),
    equipmentRows.length
      ? supabase.from("inventory_reservations").select("source_id, status").eq("client_id", project.client_id).eq("source_type", "WORK_PROJECT").eq("status", "RELEASED").in("source_id", equipmentRows.map((row) => row.id))
      : Promise.resolve({ data: [] }),
  ]);
  const productById = new Map(((products ?? []) as Array<Record<string, unknown>>).map((row) => [row.id as string, row]));
  const availableByProduct = new Map<string, number>();
  for (const row of (balances ?? []) as Array<{ product_id: string; on_hand: number; reserved: number }>) {
    availableByProduct.set(row.product_id, (availableByProduct.get(row.product_id) ?? 0) + Number(row.on_hand) - Number(row.reserved));
  }
  const confirmed = paymentRows.filter((row) => row.status === "CONFIRMED");
  const received = moneyRound(confirmed.reduce((sum, row) => sum + Number(row.amount), 0));
  const refunded = moneyRound(paymentRows.filter((row) => row.status === "REFUNDED").reduce((sum, row) => sum + Number(row.amount), 0));
  const byTerm = new Map<string, number>();
  let unallocated = 0;
  for (const row of confirmed) {
    if (row.payment_term_id) byTerm.set(row.payment_term_id, (byTerm.get(row.payment_term_id) ?? 0) + Number(row.amount));
    else unallocated += Number(row.amount);
  }
  const value = project.project_value == null ? null : Number(project.project_value);
  const paymentRequired = project.payment_required !== false;
  const status = projectPaymentStatus({
    projectValue: value,
    paymentRequired,
    confirmed: received,
    refunded,
    hasTerms: termRows.length > 0,
  });
  const gate = paymentGate({
    projectValue: value,
    terms: termRows.map((term) => ({
      id: term.id,
      trigger: term.trigger_type,
      termType: term.term_type,
      percent: term.percent == null ? null : Number(term.percent),
      amount: term.amount == null ? null : Number(term.amount),
    })),
    confirmedByTerm: byTerm,
    unallocatedConfirmed: unallocated,
  });
  const now = new Date();
  const proofIds = new Set(((links ?? []) as Array<{ entity_id: string }>).map((row) => row.entity_id));
  const quoteIds = equipmentRows.map((row) => row.source_quotation_line_id).filter(Boolean) as string[];
  const { data: quoteLines } = quoteIds.length
    ? await supabase.from("quotation_line_items").select("id, quantity").in("id", quoteIds)
    : { data: [] };
  const quoteQty = new Map(((quoteLines ?? []) as Array<{ id: string; quantity: number }>).map((row) => [row.id, Number(row.quantity)]));
  const releasedIds = new Set(((released ?? []) as Array<{ source_id: string }>).map((row) => row.source_id));
  const equipment = equipmentRows.map((row) => {
    const product = row.product_id ? productById.get(row.product_id) : undefined;
    const required = Number(row.quantity_required);
    const reserved = Number(row.quantity_reserved);
    const quoted = row.source_quotation_line_id ? quoteQty.get(row.source_quotation_line_id) : undefined;
    return {
      id: row.id,
      description: row.description,
      productId: row.product_id,
      required,
      reserved,
      issued: Number(row.quantity_issued),
      missing: quantityMissing(required, reserved, row.track_inventory && !row.cancelled),
      available: row.product_id ? moneyRound(availableByProduct.get(row.product_id) ?? 0) : 0,
      unit: row.unit,
      tracked: row.track_inventory && !row.cancelled,
      status: equipmentLineStatus({
        cancelled: row.cancelled,
        trackInventory: row.track_inventory,
        required,
        reserved,
        issued: Number(row.quantity_issued),
      }),
      supplierName: (product?.preferred_supplier_name as string | null) ?? null,
      supplierSku: (product?.supplier_sku as string | null) ?? null,
      leadTimeDays: (product?.lead_time_days as number | null) ?? null,
      cost: isManager && product?.cost_price != null ? Number(product.cost_price) : null,
      differs: quoted != null && quoted !== required,
    };
  });
  const tracked = equipment.filter((row) => row.tracked);
  const missing = equipment.filter((row) => row.missing > 0);
  const overdueTerms = termRows.filter((term) => {
    if (!term.due_date) return false;
    const paid = byTerm.get(term.id) ?? 0;
    const due = termAmount({ termType: term.term_type, percent: term.percent == null ? null : Number(term.percent), amount: term.amount == null ? null : Number(term.amount) }, value);
    return new Date(`${term.due_date}T23:59:59Z`).getTime() < now.getTime() && paid + 0.001 < due;
  }).length;
  const assessmentCompleted = ((assessments ?? []) as unknown[]).length > 0 || Boolean(project.inherited_sales_assessment_id);
  return {
    ok: true,
    data: {
      canManage: isManager,
      currency: project.currency,
      projectValue: value,
      paymentRequired,
      received,
      outstanding: outstandingBalance(value, received),
      paymentStatus: status,
      gate,
      terms: termRows.map((term) => {
        const resolved = termAmount({ termType: term.term_type, percent: term.percent == null ? null : Number(term.percent), amount: term.amount == null ? null : Number(term.amount) }, value);
        const paid = moneyRound(byTerm.get(term.id) ?? 0);
        return {
          id: term.id,
          label: term.label,
          termType: term.term_type,
          percent: term.percent == null ? null : Number(term.percent),
          amount: term.amount == null ? null : Number(term.amount),
          resolvedAmount: resolved,
          trigger: term.trigger_type,
          dueDate: term.due_date,
          paid,
          satisfied: paid + 0.001 >= resolved,
          overdue: Boolean(term.due_date) && new Date(`${term.due_date}T23:59:59Z`).getTime() < now.getTime() && paid + 0.001 < resolved,
        };
      }),
      payments: paymentRows.map((row) => ({ ...row, amount: Number(row.amount), proofCount: proofIds.has(row.id) ? 1 : 0 })),
      equipment,
      readiness: readinessSummary({
        paymentStatus: status,
        gate,
        assessmentCompleted,
        projectStatus: project.status,
        trackedRequired: tracked.reduce((sum, row) => sum + row.required, 0),
        trackedReserved: tracked.reduce((sum, row) => sum + row.reserved, 0),
        missing: missing.map((row) => ({ description: row.description, missing: row.missing })),
      }),
      attention: commercialAttention({
        paymentStatus: status,
        gateSatisfied: gate.satisfied,
        gateConfigured: gate.configured,
        pendingPayments: paymentRows.filter((row) => row.status === "PENDING").length,
        overdueTerms,
        trackedLines: tracked.length,
        reservedUnits: tracked.reduce((sum, row) => sum + row.reserved, 0),
        missingUnits: missing.reduce((sum, row) => sum + row.missing, 0),
        releasedAndEmpty: releasedIds.size > 0 && tracked.some((row) => row.reserved === 0 && row.required > 0),
      }),
      quoteDiffers: equipment.some((row) => row.differs),
      locations: ((locations ?? []) as Array<{ id: string; name: string }>).map((row) => ({ id: row.id, name: row.name })),
      assessmentCompleted,
    },
  };
}

export async function importPaymentSchedule(actor: WorkProjectActor, projectId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can set the payment schedule.");
  const project = loaded.data.project;
  if (!project.quotation_id) return fail(400, "This project has no quotation to import.");
  const supabase = createAdminClient();
  const { count } = await supabase.from("work_project_payment_terms").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("client_id", project.client_id);
  if ((count ?? 0) > 0) return fail(409, "This project already has a payment schedule.");
  const { data: quote } = await supabase.from("quotations").select("payment_schedule").eq("id", project.quotation_id).eq("client_id", project.client_id).maybeSingle();
  const schedule = Array.isArray(quote?.payment_schedule) ? quote.payment_schedule : [];
  const terms = schedule.map((row) => quoteScheduleTerm((row ?? {}) as Record<string, unknown>)).filter((row): row is NonNullable<typeof row> => row != null);
  if (!terms.length) return fail(400, "The quotation has no structured payment schedule.");
  const { error } = await supabase.from("work_project_payment_terms").insert(terms.map((term, index) => ({
    client_id: project.client_id,
    project_id: projectId,
    label: term.label,
    term_type: term.termType,
    percent: term.percent,
    amount: term.amount,
    trigger_type: term.trigger,
    sequence: index,
  })));
  if (error) return fail(500, "Could not import the payment schedule.");
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "PAYMENT_SCHEDULE_CREATED",
    title: "Payment schedule imported",
    metadata: { quotation_id: project.quotation_id, count: terms.length },
  });
  return { ok: true as const, data: { imported: terms.length } };
}

export async function addPaymentTerm(actor: WorkProjectActor, projectId: string, input: {
  label: string;
  termType: "PERCENTAGE" | "FIXED_AMOUNT";
  percent?: number | null;
  amount?: number | null;
  trigger: string;
  dueDate?: string | null;
}) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can set the payment schedule.");
  if (!input.label.trim()) return fail(400, "Enter a milestone label.");
  if (!(PAYMENT_TRIGGERS as readonly string[]).includes(input.trigger)) return fail(400, "Unknown payment trigger.");
  if (input.termType === "PERCENTAGE" && (input.percent == null || input.percent < 0 || input.percent > 100)) return fail(400, "Enter a percentage.");
  if (input.termType === "FIXED_AMOUNT" && (input.amount == null || input.amount < 0)) return fail(400, "Enter an amount.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("work_project_payment_terms").insert({
    client_id: loaded.data.project.client_id,
    project_id: projectId,
    label: input.label.trim(),
    term_type: input.termType,
    percent: input.termType === "PERCENTAGE" ? input.percent : null,
    amount: input.termType === "FIXED_AMOUNT" ? input.amount : null,
    trigger_type: input.trigger,
    due_date: input.dueDate || null,
  });
  if (error) return fail(500, "Could not add the milestone.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "PAYMENT_TERM_ADDED",
    title: "Payment milestone added",
    description: input.label.trim(),
  });
  return { ok: true as const, data: { added: true } };
}

export async function recordProjectPayment(actor: WorkProjectActor, projectId: string, input: {
  amount: number;
  paidAt: string;
  method: string;
  reference?: string | null;
  termId?: string | null;
  notes?: string | null;
}) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canReadWorkProject(actor, loaded.data.scope)) return fail(403, "You cannot record a payment on this project.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) return fail(400, "Enter a payment amount.");
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail(400, "Unknown payment method.");
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) return fail(400, "Enter a payment date.");
  const supabase = createAdminClient();
  if (input.termId) {
    const { data: term } = await supabase.from("work_project_payment_terms").select("id").eq("id", input.termId).eq("project_id", projectId).eq("client_id", loaded.data.project.client_id).maybeSingle();
    if (!term) return fail(400, "That milestone is not on this project.");
  }
  const { data, error } = await supabase.from("work_project_payments").insert({
    client_id: loaded.data.project.client_id,
    project_id: projectId,
    payment_term_id: input.termId || null,
    amount: input.amount,
    currency: loaded.data.project.currency,
    payment_method: input.method,
    reference: input.reference?.trim() || null,
    paid_at: paidAt.toISOString(),
    status: "PENDING",
    notes: input.notes?.trim() || null,
    recorded_by: actor.userId,
  }).select("id").single();
  if (error || !data) return fail(500, "Could not record the payment.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "PAYMENT_RECORDED",
    title: "Payment recorded",
    metadata: { payment_id: data.id, amount: input.amount, status: "PENDING" },
  });
  return { ok: true as const, data: { id: data.id as string, status: "PENDING" } };
}

export async function confirmProjectPayment(actor: WorkProjectActor, projectId: string, paymentId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can confirm a payment.");
  const before = await loadProjectCommercial(actor, projectId);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("confirm_work_project_payment", {
    p_client_id: loaded.data.project.client_id,
    p_payment_id: paymentId,
    p_actor_id: actor.userId,
  });
  if (error) return fail(500, "Could not confirm the payment.");
  const result = (data ?? {}) as { ok?: boolean; error?: string; project_id?: string };
  if (!result.ok) {
    if (result.error === "not_found") return fail(404, "Payment not found.");
    return fail(400, "Only a pending payment can be confirmed.");
  }
  const after = await loadProjectCommercial(actor, projectId);
  if (before.ok && after.ok && before.data.gate.configured && !before.data.gate.satisfied && after.data.gate.satisfied && loaded.data.project.project_owner_id) {
    await supabase.from("notifications").insert({
      user_id: loaded.data.project.project_owner_id,
      type: "WORK_PROJECT_ALERT",
      message: `${loaded.data.project.title}: the deposit requirement has been met.`,
      read: false,
    });
  }
  return { ok: true as const, data: { id: paymentId, projectId: result.project_id } };
}

export async function reverseProjectPayment(actor: WorkProjectActor, projectId: string, paymentId: string, reason: string, refund: boolean) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can reverse a payment.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reverse_work_project_payment", {
    p_client_id: loaded.data.project.client_id,
    p_payment_id: paymentId,
    p_actor_id: actor.userId,
    p_reason: reason,
    p_refund: refund,
  });
  if (error) return fail(500, "Could not reverse the payment.");
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) {
    if (result.error === "not_found") return fail(404, "Payment not found.");
    if (result.error === "reason_required") return fail(400, "Enter a reason.");
    return fail(400, "Only a confirmed payment can be reversed.");
  }
  return { ok: true as const, data: { id: paymentId } };
}

export async function attachPaymentProof(actor: WorkProjectActor, projectId: string, paymentId: string, documentId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id) && actor.role !== "SALESPERSON") {
    return fail(403, "You cannot attach payment proof.");
  }
  const supabase = createAdminClient();
  const { data: payment } = await supabase.from("work_project_payments").select("id").eq("id", paymentId).eq("project_id", projectId).eq("client_id", loaded.data.project.client_id).maybeSingle();
  if (!payment) return fail(404, "Payment not found.");
  const { data: document } = await supabase.from("documents").select("id").eq("id", documentId).eq("client_id", loaded.data.project.client_id).maybeSingle();
  if (!document) return fail(404, "Document not found.");
  await createManualDocumentLink({
    clientId: loaded.data.project.client_id,
    documentId,
    actorUserId: actor.userId,
    candidate: {
      entityType: "WORK_PROJECT_PAYMENT",
      entityId: paymentId,
      linkType: "MANUAL",
      confidence: "HIGH",
      matchReason: "payment proof",
      label: "Payment",
    },
  });
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "PAYMENT_PROOF_ADDED",
    title: "Payment proof added",
    metadata: { payment_id: paymentId, document_id: documentId },
  });
  return { ok: true as const, data: { linked: true } };
}

export async function importProjectEquipment(actor: WorkProjectActor, projectId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can create the equipment list.");
  const project = loaded.data.project;
  if (!project.quotation_id) return fail(400, "This project has no quotation to import.");
  const supabase = createAdminClient();
  const { data: lines } = await supabase
    .from("quotation_line_items")
    .select("id, item_name, description, quantity, unit, product_id, variant_id, is_optional, package_id")
    .eq("quotation_id", project.quotation_id);
  const rows = (lines ?? []) as Array<{
    id: string;
    item_name: string | null;
    description: string | null;
    quantity: number;
    unit: string | null;
    product_id: string | null;
    variant_id: string | null;
    is_optional: boolean | null;
    package_id: string | null;
  }>;
  const productIds = rows.map((row) => row.product_id).filter(Boolean) as string[];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, track_inventory").in("id", productIds).eq("client_id", project.client_id)
    : { data: [] };
  const tracked = new Map(((products ?? []) as Array<{ id: string; track_inventory: boolean }>).map((row) => [row.id, row.track_inventory]));
  const existing = await supabase.from("work_project_equipment").select("source_quotation_line_id").eq("project_id", projectId).eq("client_id", project.client_id);
  const seen = new Set(((existing.data ?? []) as Array<{ source_quotation_line_id: string | null }>).map((row) => row.source_quotation_line_id));
  const inserts = rows
    .filter((row) => !row.is_optional)
    .filter((row) => !(row.package_id && !row.product_id))
    .filter((row) => !seen.has(row.id))
    .map((row) => ({
      client_id: project.client_id,
      project_id: projectId,
      product_id: row.product_id,
      variant_id: row.variant_id,
      description: row.item_name || row.description || "Item",
      quantity_required: Number(row.quantity) || 0,
      source_quantity: Number(row.quantity) || 0,
      unit: row.unit,
      track_inventory: Boolean(row.product_id && tracked.get(row.product_id)),
      source_quotation_line_id: row.id,
    }));
  if (!inserts.length) return { ok: true as const, data: { created: 0 } };
  const { error } = await supabase.from("work_project_equipment").insert(inserts);
  if (error) return fail(500, "Could not create the equipment list.");
  await writeEvent({
    clientId: project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "EQUIPMENT_LIST_CREATED",
    title: "Equipment list created",
    metadata: { quotation_id: project.quotation_id, count: inserts.length },
  });
  return { ok: true as const, data: { created: inserts.length } };
}

export async function addProjectEquipment(actor: WorkProjectActor, projectId: string, input: {
  description: string;
  quantity: number;
  productId?: string | null;
  unit?: string | null;
}) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can change equipment.");
  if (!input.description.trim() || !Number.isFinite(input.quantity) || input.quantity < 0) return fail(400, "Enter an item and quantity.");
  const supabase = createAdminClient();
  let tracked = false;
  if (input.productId) {
    const { data: product } = await supabase.from("products").select("id, track_inventory").eq("id", input.productId).eq("client_id", loaded.data.project.client_id).maybeSingle();
    if (!product) return fail(400, "That product is not in this company.");
    tracked = Boolean(product.track_inventory);
  }
  const { error } = await supabase.from("work_project_equipment").insert({
    client_id: loaded.data.project.client_id,
    project_id: projectId,
    product_id: input.productId || null,
    description: input.description.trim(),
    quantity_required: input.quantity,
    unit: input.unit || null,
    track_inventory: tracked,
  });
  if (error) return fail(500, "Could not add the equipment.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "EQUIPMENT_UPDATED",
    title: "Equipment updated",
    description: input.description.trim(),
  });
  return { ok: true as const, data: { added: true } };
}

export async function updateProjectEquipment(actor: WorkProjectActor, projectId: string, equipmentId: string, quantity: number) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can change equipment.");
  if (!Number.isFinite(quantity) || quantity < 0) return fail(400, "Enter a quantity.");
  const supabase = createAdminClient();
  const { data: row } = await supabase.from("work_project_equipment").select("id, quantity_reserved").eq("id", equipmentId).eq("project_id", projectId).eq("client_id", loaded.data.project.client_id).maybeSingle();
  if (!row) return fail(404, "Equipment not found.");
  if (quantity + 0.001 < Number(row.quantity_reserved)) return fail(400, "Release the reservation before lowering the quantity below what is reserved.");
  const { error } = await supabase.from("work_project_equipment").update({ quantity_required: quantity, updated_at: new Date().toISOString() }).eq("id", equipmentId);
  if (error) return fail(500, "Could not update the equipment.");
  await writeEvent({
    clientId: loaded.data.project.client_id,
    projectId,
    actorId: actor.userId,
    eventType: "EQUIPMENT_UPDATED",
    title: "Equipment updated",
    metadata: { equipment_id: equipmentId, quantity },
  });
  return { ok: true as const, data: { id: equipmentId } };
}

export async function reserveProjectEquipment(actor: WorkProjectActor, projectId: string, locationId: string) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can reserve stock.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reserve_work_project_stock", {
    p_client_id: loaded.data.project.client_id,
    p_project_id: projectId,
    p_location_id: locationId,
    p_actor_id: actor.userId,
  });
  if (error) return fail(500, "Could not reserve stock.");
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) return fail(400, "Choose a stock location in this company.");
  return { ok: true as const, data: result };
}

export async function releaseProjectEquipment(actor: WorkProjectActor, projectId: string, equipmentId: string | null) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can release stock.");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("release_work_project_stock", {
    p_client_id: loaded.data.project.client_id,
    p_project_id: projectId,
    p_equipment_id: equipmentId,
    p_actor_id: actor.userId,
  });
  if (error) return fail(500, "Could not release the reservation.");
  return { ok: true as const, data: data ?? { ok: true } };
}

export async function setPaymentRequired(actor: WorkProjectActor, projectId: string, required: boolean) {
  const loaded = await scoped(actor, projectId);
  if (!loaded.ok) return loaded;
  if (!canManageWorkProjects(actor, loaded.data.project.client_id)) return fail(403, "Only a manager can change the payment requirement.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("work_projects").update({ payment_required: required, updated_at: new Date().toISOString() }).eq("id", projectId).eq("client_id", loaded.data.project.client_id);
  if (error) return fail(500, "Could not update the payment requirement.");
  return { ok: true as const, data: { paymentRequired: required } };
}

export async function loadCommercialOperations(clientId: string) {
  const supabase = createAdminClient();
  const [{ data: projects }, { data: terms }, { data: payments }, { data: equipment }] = await Promise.all([
    supabase.from("work_projects").select("id, status, project_value, payment_required, currency").eq("client_id", clientId),
    supabase.from("work_project_payment_terms").select("project_id, id, term_type, percent, amount, trigger_type").eq("client_id", clientId),
    supabase.from("work_project_payments").select("project_id, payment_term_id, amount, status").eq("client_id", clientId),
    supabase.from("work_project_equipment").select("project_id, description, quantity_required, quantity_reserved, track_inventory, cancelled").eq("client_id", clientId),
  ]);
  const open = ((projects ?? []) as Array<{ id: string; status: string; project_value: number | null; payment_required: boolean }>).filter((project) => project.status !== "CANCELLED" && project.status !== "COMPLETED");
  const openIds = new Set(open.map((project) => project.id));
  let awaitingDeposit = 0;
  let partiallyPaid = 0;
  let readyForEquipment = 0;
  let missingStock = 0;
  let fullyReserved = 0;
  let outstandingTotal = 0;
  for (const project of open) {
    const projectTerms = ((terms ?? []) as TermRow[]).filter((term) => term.project_id === project.id);
    const projectPayments = ((payments ?? []) as Array<PaymentRow & { project_id: string }>).filter((row) => row.project_id === project.id);
    const confirmed = projectPayments.filter((row) => row.status === "CONFIRMED");
    const received = confirmed.reduce((sum, row) => sum + Number(row.amount), 0);
    const refunded = projectPayments.filter((row) => row.status === "REFUNDED").reduce((sum, row) => sum + Number(row.amount), 0);
    const byTerm = new Map<string, number>();
    let unallocated = 0;
    for (const row of confirmed) {
      if (row.payment_term_id) byTerm.set(row.payment_term_id, (byTerm.get(row.payment_term_id) ?? 0) + Number(row.amount));
      else unallocated += Number(row.amount);
    }
    const value = project.project_value == null ? null : Number(project.project_value);
    const status = projectPaymentStatus({
      projectValue: value,
      paymentRequired: project.payment_required !== false,
      confirmed: received,
      refunded,
      hasTerms: projectTerms.length > 0,
    });
    const gate = paymentGate({
      projectValue: value,
      terms: projectTerms.map((term) => ({
        id: term.id,
        trigger: term.trigger_type,
        termType: term.term_type,
        percent: term.percent == null ? null : Number(term.percent),
        amount: term.amount == null ? null : Number(term.amount),
      })),
      confirmedByTerm: byTerm,
      unallocatedConfirmed: unallocated,
    });
    if (gate.configured && !gate.satisfied) awaitingDeposit += 1;
    if (status === "PARTIALLY_PAID") partiallyPaid += 1;
    if (value != null) outstandingTotal += Math.max(0, value - received);
    const lines = ((equipment ?? []) as Array<{ project_id: string; quantity_required: number; quantity_reserved: number; track_inventory: boolean; cancelled: boolean }>).filter((row) => row.project_id === project.id && row.track_inventory && !row.cancelled);
    const missing = lines.reduce((sum, row) => sum + quantityMissing(Number(row.quantity_required), Number(row.quantity_reserved), true), 0);
    const required = lines.reduce((sum, row) => sum + Number(row.quantity_required), 0);
    if (missing > 0) missingStock += 1;
    if (lines.length && missing === 0) fullyReserved += 1;
    if ((gate.configured ? gate.satisfied : status === "PAID" || status === "NOT_REQUIRED") && missing > 0) readyForEquipment += 1;
    if (required === 0) {
      /* service-only projects are not missing stock */
    }
  }
  const procurement = ((equipment ?? []) as Array<{ project_id: string; description: string; quantity_required: number; quantity_reserved: number; track_inventory: boolean; cancelled: boolean }>)
    .filter((row) => openIds.has(row.project_id) && row.track_inventory && !row.cancelled)
    .map((row) => ({
      description: row.description,
      missing: quantityMissing(Number(row.quantity_required), Number(row.quantity_reserved), true),
      projectId: row.project_id,
      projectValue: Number(open.find((project) => project.id === row.project_id)?.project_value ?? 0),
    }))
    .filter((row) => row.missing > 0);
  return {
    awaitingDeposit,
    partiallyPaid,
    readyForEquipment,
    missingStock,
    fullyReserved,
    outstandingTotal: moneyRound(outstandingTotal),
    procurement,
  };
}
