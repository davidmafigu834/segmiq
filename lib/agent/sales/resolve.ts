import { createAdminClient } from "@/lib/supabase/admin";
import { asRows } from "@/lib/agent/rows";
import { searchCommercialItems } from "@/lib/products/search";
import { hasCommercialPermission } from "@/lib/commercial/permissions";
import { DEAL_ACTIVE_STAGES, DEAL_STAGE_LABEL, formatDealStage } from "@/lib/sales/deals/display";
import { PRODUCT_SEARCH_LIMIT, type SalesActor, type SalesChoice, type SalesPageContext } from "./types";
import { salesActorCanAccessDeal, salesActorCanAccessLead, sameRecordId } from "./policy";

type LeadAccessRow = {
  id: string;
  name: string | null;
  project_type: string | null;
  location: string | null;
  assigned_to_id: string | null;
  contact_id: string | null;
  active_deal_id: string | null;
  client_id: string | null;
  whatsapp_collaborator_ids?: string[] | null;
};

function collaboratorIdsFrom(row: { whatsapp_collaborator_ids?: string[] | null }): string[] {
  return Array.isArray(row.whatsapp_collaborator_ids)
    ? row.whatsapp_collaborator_ids.filter((id): id is string => typeof id === "string")
    : [];
}

export type MatchResult<T> =
  | { kind: "none" }
  | { kind: "one"; value: T }
  | { kind: "many"; values: T[] };

function scoreName(name: string, query: string): number {
  const n = name.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => n.includes(t)).length;
  return tokens.length ? (hits / tokens.length) * 40 : 0;
}

export type ResolvedCustomer = {
  leadId: string;
  contactId: string | null;
  name: string;
  projectType: string | null;
  location: string | null;
  dealId: string | null;
  dealName: string | null;
  dealStage: string | null;
  assignedToId: string | null;
};

export async function resolveCustomer(opts: {
  actor: SalesActor;
  page: SalesPageContext;
  source?: "CURRENT_CONTEXT" | "SEARCH" | "ID" | "SELECTED";
  query?: string;
  id?: string;
}): Promise<MatchResult<ResolvedCustomer> & { choices?: SalesChoice[] }> {
  const supabase = createAdminClient();
  const contextLeadId = opts.page.leadId ?? opts.page.conversationId ?? null;
  const useOpenConversation =
    opts.source === "CURRENT_CONTEXT" ||
    ((opts.source === undefined || opts.source === "SEARCH") && !opts.query && Boolean(contextLeadId));

  if (useOpenConversation && contextLeadId) {
    const one = await loadAccessibleLead(opts.actor, contextLeadId, opts.page);
    if (one) return { kind: "one", value: one };
    if (opts.page.customerId) {
      const byContact = await loadAccessibleLeadByContact(opts.actor, opts.page.customerId, opts.page);
      if (byContact) return { kind: "one", value: byContact };
    }
    if (opts.source === "CURRENT_CONTEXT" || !opts.query) return { kind: "none" };
  }

  if ((opts.source === "ID" || opts.source === "SELECTED") && opts.id) {
    const one = await loadAccessibleLead(opts.actor, opts.id, opts.page);
    if (one) return { kind: "one", value: one };
    return { kind: "none" };
  }

  const q = (opts.query ?? "").trim();
  if (!q) return { kind: "none" };

  let query = supabase
    .from("leads")
    .select("id, name, project_type, location, assigned_to_id, contact_id, active_deal_id, client_id")
    .eq("client_id", opts.actor.clientId)
    .ilike("name", `%${q.replace(/[%_,]/g, "")}%`)
    .limit(8);
  if (opts.actor.role === "SALESPERSON") {
    query = query.or(`assigned_to_id.eq.${opts.actor.userId},assigned_to_id.is.null`);
  }
  const { data } = await query;
  const rows = asRows<{
    id: string;
    name: string | null;
    project_type: string | null;
    location: string | null;
    assigned_to_id: string | null;
    contact_id: string | null;
    active_deal_id: string | null;
  }>(data);

  const mapped: ResolvedCustomer[] = [];
  for (const row of rows) {
    if (
      !salesActorCanAccessLead({
        actor: opts.actor,
        clientId: opts.actor.clientId,
        assignedToId: row.assigned_to_id,
        collaboratorIds: collaboratorIdsFrom(row as LeadAccessRow),
        pageCompanyId: opts.page.companyId,
      })
    ) {
      continue;
    }
    const deal = row.active_deal_id ? await loadAccessibleDeal(opts.actor, row.active_deal_id, true) : null;
    mapped.push({
      leadId: row.id,
      contactId: row.contact_id,
      name: row.name || "Customer",
      projectType: row.project_type,
      location: row.location,
      dealId: deal?.id ?? row.active_deal_id,
      dealName: deal?.name ?? null,
      dealStage: deal?.stageLabel ?? null,
      assignedToId: row.assigned_to_id,
    });
  }

  const exact = mapped.filter((m) => m.name.trim().toLowerCase() === q.toLowerCase());
  const pool = exact.length ? exact : mapped.filter((m) => scoreName(m.name, q) >= 40);
  if (pool.length === 0) return { kind: "none" };
  if (pool.length === 1) return { kind: "one", value: pool[0]! };
  return {
    kind: "many",
    values: pool,
    choices: pool.map(customerChoice),
  };
}

export function customerChoice(c: ResolvedCustomer): SalesChoice {
  const bits = [c.projectType, c.location].filter(Boolean).join(" · ");
  return {
    id: c.leadId,
    entityType: "CUSTOMER",
    title: c.name,
    subtitle: bits || null,
    status: c.dealStage ? `Deal: ${c.dealStage}` : "No active Deal",
    meta: { dealId: c.dealId, dealName: c.dealName },
    href: `/sales/inbox?conversation=${c.leadId}`,
  };
}

async function mapLeadRow(actor: SalesActor, data: LeadAccessRow, page?: SalesPageContext): Promise<ResolvedCustomer | null> {
  if (
    !salesActorCanAccessLead({
      actor,
      clientId: data.client_id,
      assignedToId: data.assigned_to_id,
      collaboratorIds: collaboratorIdsFrom(data),
      pageCompanyId: page?.companyId,
      openLeadId: page?.leadId ?? page?.conversationId ?? null,
      leadId: data.id,
    })
  ) {
    return null;
  }
  const deal = data.active_deal_id ? await loadAccessibleDeal(actor, data.active_deal_id, true, page) : null;
  return {
    leadId: data.id,
    contactId: data.contact_id,
    name: data.name || "Customer",
    projectType: data.project_type,
    location: data.location,
    dealId: deal?.id ?? data.active_deal_id,
    dealName: deal?.name ?? null,
    dealStage: deal?.stageLabel ?? null,
    assignedToId: data.assigned_to_id,
  };
}

const LEAD_SELECT =
  "id, name, project_type, location, assigned_to_id, contact_id, active_deal_id, client_id, whatsapp_collaborator_ids";
const LEAD_SELECT_FALLBACK =
  "id, name, project_type, location, assigned_to_id, contact_id, active_deal_id, client_id";

async function fetchLeadById(leadId: string): Promise<LeadAccessRow | null> {
  const supabase = createAdminClient();
  const full = await supabase.from("leads").select(LEAD_SELECT).eq("id", leadId).maybeSingle();
  if (full.data) return full.data as LeadAccessRow;
  const msg = String(full.error?.message ?? "");
  if (msg.includes("whatsapp_collaborator")) {
    const retry = await supabase.from("leads").select(LEAD_SELECT_FALLBACK).eq("id", leadId).maybeSingle();
    return (retry.data as LeadAccessRow | null) ?? null;
  }
  return null;
}

async function loadAccessibleLead(
  actor: SalesActor,
  leadId: string,
  page?: SalesPageContext
): Promise<ResolvedCustomer | null> {
  const data = await fetchLeadById(leadId);
  if (!data) return null;
  return mapLeadRow(actor, data, page);
}

async function loadAccessibleLeadByContact(
  actor: SalesActor,
  contactId: string,
  page?: SalesPageContext
): Promise<ResolvedCustomer | null> {
  const supabase = createAdminClient();
  let query = supabase.from("leads").select(LEAD_SELECT).eq("contact_id", contactId).limit(8);
  if (actor.role !== "SUPER_ADMIN") query = query.eq("client_id", actor.clientId);
  const { data, error } = await query;
  let rows = asRows<LeadAccessRow>(data);
  if (error && String(error.message).includes("whatsapp_collaborator")) {
    let retry = supabase.from("leads").select(LEAD_SELECT_FALLBACK).eq("contact_id", contactId).limit(8);
    if (actor.role !== "SUPER_ADMIN") retry = retry.eq("client_id", actor.clientId);
    const again = await retry;
    rows = asRows<LeadAccessRow>(again.data);
  }
  for (const row of rows) {
    const mapped = await mapLeadRow(actor, row, page);
    if (mapped) return mapped;
  }
  return null;
}

export type ResolvedDeal = {
  id: string;
  name: string;
  stage: string;
  stageLabel: string;
  ownerId: string | null;
  leadId: string;
};

export async function loadAccessibleDeal(
  actor: SalesActor,
  dealId: string,
  originatingLeadAccessible = false,
  page?: SalesPageContext
): Promise<ResolvedDeal | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select("id, name, stage, owner_id, originating_lead_id, client_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!data) return null;
  if (
    !salesActorCanAccessDeal({
      actor,
      clientId: (data.client_id as string | null) ?? null,
      ownerId: (data.owner_id as string | null) ?? null,
      originatingLeadAccessible,
      pageCompanyId: page?.companyId,
    })
  ) {
    return null;
  }
  const stage = (data.stage as string) ?? "";
  return {
    id: data.id as string,
    name: (data.name as string | null) || "Deal",
    stage,
    stageLabel: formatDealStage(stage),
    ownerId: (data.owner_id as string | null) ?? null,
    leadId: data.originating_lead_id as string,
  };
}

export async function resolveDealsForCustomer(opts: {
  actor: SalesActor;
  leadId: string;
  preferredDealId?: string | null;
  page?: SalesPageContext;
}): Promise<MatchResult<ResolvedDeal> & { choices?: SalesChoice[] }> {
  if (opts.preferredDealId) {
    const one = await loadAccessibleDeal(opts.actor, opts.preferredDealId, true, opts.page);
    if (one && one.leadId === opts.leadId) return { kind: "one", value: one };
  }
  const supabase = createAdminClient();
  let q = supabase
    .from("deals")
    .select("id, name, stage, owner_id, originating_lead_id, client_id")
    .eq("client_id", opts.actor.clientId)
    .eq("originating_lead_id", opts.leadId)
    .in("stage", [...DEAL_ACTIVE_STAGES])
    .order("updated_at", { ascending: false });
  const openLeadId = opts.page?.leadId ?? opts.page?.conversationId ?? null;
  const quotingOpenLead = Boolean(openLeadId && sameRecordId(openLeadId, opts.leadId));
  if (opts.actor.role === "SALESPERSON" && !quotingOpenLead) {
    q = q.or(`owner_id.eq.${opts.actor.userId},owner_id.is.null`);
  }
  const { data } = await q;
  const rows = asRows<{
    id: string;
    name: string | null;
    stage: string;
    owner_id: string | null;
    originating_lead_id: string;
  }>(data).map((d) => ({
    id: d.id,
    name: d.name || "Deal",
    stage: d.stage,
    stageLabel: DEAL_STAGE_LABEL[d.stage as keyof typeof DEAL_STAGE_LABEL] ?? formatDealStage(d.stage),
    ownerId: d.owner_id,
    leadId: d.originating_lead_id,
  }));
  if (rows.length === 0) return { kind: "none" };
  if (rows.length === 1) return { kind: "one", value: rows[0]! };
  return {
    kind: "many",
    values: rows,
    choices: rows.map((d) => ({
      id: d.id,
      entityType: "DEAL" as const,
      title: d.name,
      subtitle: d.stageLabel,
      status: d.stageLabel,
      href: `/sales/deals/${d.id}`,
    })),
  };
}

export type ResolvedCatalogItem = {
  type: "PACKAGE" | "PRODUCT" | "SERVICE";
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  currency: string;
  availability: string | null;
  availableQty: number | null;
  hasVariants: boolean;
  pricingMode?: string | null;
};

export async function resolveCatalogQuery(opts: {
  actor: SalesActor;
  query: string;
  prefer?: "PACKAGE" | "PRODUCT" | "SERVICE" | "AUTO";
}): Promise<MatchResult<ResolvedCatalogItem> & { choices?: SalesChoice[]; bothTypes?: boolean }> {
  const q = opts.query.trim();
  if (!q) return { kind: "none" };

  const prefer = opts.prefer ?? "AUTO";
  const types =
    prefer === "PACKAGE"
      ? (["PACKAGE"] as const)
      : prefer === "SERVICE"
        ? (["SERVICE"] as const)
        : prefer === "PRODUCT"
          ? (["PRODUCT"] as const)
          : (["PACKAGE", "PRODUCT", "SERVICE"] as const);

  const canViewProducts = hasCommercialPermission(
    { userId: opts.actor.userId, role: opts.actor.role, clientId: opts.actor.clientId },
    "products.view"
  );
  const canViewPackages = hasCommercialPermission(
    { userId: opts.actor.userId, role: opts.actor.role, clientId: opts.actor.clientId },
    "packages.view"
  );
  const allowedTypes = types.filter((t) => (t === "PACKAGE" ? canViewPackages : canViewProducts));
  if (!allowedTypes.length) return { kind: "none" };

  const { results } = await searchCommercialItems({
    clientId: opts.actor.clientId,
    q,
    types: [...allowedTypes],
    limit: PRODUCT_SEARCH_LIMIT,
    canSeeCost: false,
  });

  const mapped: ResolvedCatalogItem[] = results.map((r) => ({
    type: r.type,
    id: r.id,
    name: r.name,
    sku: r.sku ?? null,
    price: r.price ?? null,
    currency: r.currency ?? "USD",
    availability: r.availability ?? null,
    availableQty: r.availableQty ?? null,
    hasVariants: Boolean(r.hasVariants),
    pricingMode: r.pricingMode ?? null,
  }));

  const exactPkg = mapped.filter((m) => m.type === "PACKAGE" && m.name.toLowerCase() === q.toLowerCase());
  const exactProd = mapped.filter((m) => m.type !== "PACKAGE" && m.name.toLowerCase() === q.toLowerCase());
  if (exactPkg.length === 1 && exactProd.length === 0) return { kind: "one", value: exactPkg[0]! };
  if (exactProd.length === 1 && exactPkg.length === 0) return { kind: "one", value: exactProd[0]! };
  if (exactPkg.length === 1 && exactProd.length >= 1) {
    return {
      kind: "many",
      values: [...exactPkg, ...exactProd],
      bothTypes: true,
      choices: [...exactPkg, ...exactProd].map(catalogChoice),
    };
  }

  const scored = mapped
    .map((m) => ({ m, s: scoreName(m.name, q) }))
    .filter((x) => x.s >= 40)
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0) return { kind: "none" };
  if (scored.length === 1 || (scored[0]!.s >= 80 && scored[0]!.s - (scored[1]?.s ?? 0) >= 25)) {
    return { kind: "one", value: scored[0]!.m };
  }
  return {
    kind: "many",
    values: scored.map((x) => x.m),
    choices: scored.map((x) => catalogChoice(x.m)),
  };
}

export function catalogChoice(item: ResolvedCatalogItem): SalesChoice {
  const avail =
    item.availableQty != null
      ? `Available: ${item.availableQty}`
      : item.availability === "NOT_TRACKED"
        ? "Not tracked"
        : item.availability;
  return {
    id: item.id,
    entityType: item.type,
    title: item.name,
    subtitle: item.sku,
    status: item.type,
    availableLabel: avail ?? null,
    meta: { price: item.price, currency: item.currency, hasVariants: item.hasVariants ? 1 : 0 },
  };
}

export async function loadProductVariants(opts: {
  actor: SalesActor;
  productId: string;
}): Promise<Array<{ id: string; name: string; sku: string | null; price: number | null }>> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("product_variants")
    .select("id, name, sku, selling_price_override")
    .eq("client_id", opts.actor.clientId)
    .eq("product_id", opts.productId)
    .eq("status", "ACTIVE")
    .order("name");
  return asRows<{ id: string; name: string; sku: string | null; selling_price_override: number | null }>(data).map(
    (v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.selling_price_override,
    })
  );
}

export function variantQuantitiesMatch(
  requestedTotal: number,
  allocations: Array<{ quantity: number }>
): { ok: true; total: number } | { ok: false; total: number; requested: number } {
  const total = allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
  if (total === requestedTotal) return { ok: true, total };
  return { ok: false, total, requested: requestedTotal };
}

export async function searchCustomers(actor: SalesActor, query: string): Promise<SalesChoice[]> {
  const result = await resolveCustomer({ actor, page: {}, source: "SEARCH", query });
  if (result.kind === "one") return [customerChoice(result.value)];
  if (result.kind === "many") return result.choices ?? [];
  return [];
}

export async function searchDealsMine(actor: SalesActor, query?: string): Promise<SalesChoice[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("deals")
    .select("id, name, stage, owner_id, originating_lead_id")
    .eq("client_id", actor.clientId)
    .eq("owner_id", actor.userId)
    .in("stage", [...DEAL_ACTIVE_STAGES])
    .order("updated_at", { ascending: false })
    .limit(12);
  if (query?.trim()) q = q.ilike("name", `%${query.trim().replace(/[%_,]/g, "")}%`);
  const { data } = await q;
  return asRows<{ id: string; name: string | null; stage: string }>(data).map((d) => ({
    id: d.id,
    entityType: "DEAL" as const,
    title: d.name || "Deal",
    subtitle: formatDealStage(d.stage),
    status: formatDealStage(d.stage),
    href: `/sales/deals/${d.id}`,
  }));
}
