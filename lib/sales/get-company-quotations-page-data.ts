import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveQuoteStatus } from "@/lib/sales/quotes/format";
import {
  companyQuotationAttention,
  companyQuotationMatchesTab,
  emptyCompanyQuotationCounts,
} from "@/lib/sales/company-quotations";
import { computeQuotationTotals } from "@/lib/quotations/totals";
import {
  evaluateGovernance,
  resolveMarginVisibility,
} from "@/lib/quotations/governance";
import type {
  MarginHealthState,
  QuotationLineItemInput,
  QuotationSettingsRow,
  QuotationStatus,
  UserRole,
} from "@/types";
import type {
  CompanyQuotationOwner,
  CompanyQuotationPermissions,
  CompanyQuotationRow,
  CompanyQuotationsPageData,
} from "@/components/dashboard/company/quotations/types";

type Actor = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  alsoSells?: boolean;
};

type DbQuote = {
  id: string;
  client_id: string;
  lead_id: string;
  deal_id: string | null;
  quote_number: string | null;
  revision_number: number | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total: number | string | null;
  subtotal?: number | string | null;
  tax_amount?: number | string | null;
  other_amount?: number | string | null;
  tax_rate?: number | string | null;
  currency: string | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  last_viewed_at?: string | null;
  view_count?: number | null;
  created_at: string;
  updated_at: string;
  public_token: string | null;
  approval_status?: string | null;
  approval_note?: string | null;
  approval_required_reasons?: unknown;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approved_by_id?: string | null;
  approval_snapshot?: Record<string, unknown> | null;
  discount_percent?: number | null;
  customer_response_type?: string | null;
  customer_response_category?: string | null;
  customer_response_message?: string | null;
  accepted_total?: number | string | null;
  declined_reason?: string | null;
  parent_quotation_id?: string | null;
  customer_configuration?: { selected_offer_option_id?: string | null } | null;
  selected_offer_option_id?: string | null;
  offer_options?: Array<{ id: string; label: string }> | null;
  prepared_by_id: string | null;
  prepared_by_name: string | null;
};

type DbLead = {
  id: string;
  client_id: string;
  assigned_to_id: string | null;
  contact_id: string | null;
  active_deal_id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  project_type: string | null;
  status: string;
  is_archived: boolean | null;
};

type DbDeal = {
  id: string;
  name: string;
  service_summary: string | null;
  owner_id: string | null;
  contact_id: string | null;
  estimated_value: number | string | null;
  won_value: number | string | null;
  stage?: string | null;
};

type DbUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
};

type DbLine = {
  quotation_id: string;
  unit_price: number | string | null;
  quantity: number | string | null;
  discount_percent?: number | string | null;
  cost_price?: number | string | null;
  catalog_unit_price?: number | string | null;
  catalog_item_id?: string | null;
  is_optional?: boolean | null;
  item_name?: string | null;
};

function finiteMoney(value: number | string | null | undefined): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function finiteOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function labelForCustomer(row: CompanyQuotationRow): string {
  return row.customerName.trim() || "Unnamed customer";
}

function parseReasons(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseReasons(parsed);
    } catch {
      return [value.trim()];
    }
  }
  return [];
}

function snapshotNumber(snapshot: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!snapshot) return null;
  return finiteOrNull(snapshot[key] as number | string | null);
}

/**
 * Company-wide quotation workspace data.
 *
 * Definitions:
 * - Status counts use the canonical quotation status after date-based expiry.
 * - Sent includes Viewed: the customer still has the offer.
 * - Needs attention is a real work queue (approval, changes, expiry, stale sent, accepted Deal still open).
 * - Accepted quotation value is accepted offer totals, never labelled Revenue.
 * - Quotation owner is Deal owner, then Lead owner, then the quote preparer.
 */
export async function getCompanyQuotationsPageData({
  clientId,
  actor,
}: {
  clientId: string;
  actor: Actor;
}): Promise<CompanyQuotationsPageData> {
  if (actor.role !== "SUPER_ADMIN" && actor.clientId !== clientId) {
    throw new Error("Forbidden company quotation scope");
  }

  const supabase = createAdminClient();
  const isManager = actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN";
  const quoteSelect =
    "id, client_id, lead_id, deal_id, quote_number, revision_number, status, customer_name, customer_phone, customer_email, total, subtotal, tax_amount, other_amount, tax_rate, currency, valid_until, sent_at, viewed_at, last_viewed_at, view_count, created_at, updated_at, public_token, prepared_by_id, prepared_by_name, approval_status, approval_note, approval_required_reasons, approval_requested_at, approved_at, approved_by_id, approval_snapshot, discount_percent, customer_response_type, customer_response_category, customer_response_message, accepted_total, declined_reason, parent_quotation_id, customer_configuration, selected_offer_option_id, offer_options";
  const quoteSelectFallback =
    "id, client_id, lead_id, deal_id, quote_number, revision_number, status, customer_name, customer_phone, customer_email, total, currency, valid_until, sent_at, viewed_at, created_at, updated_at, public_token, prepared_by_id, prepared_by_name, approval_status, approval_note, discount_percent";

  const [clientRes, quoteFirst, leadRes, dealRes, userRes, templateRes, settingsRes] =
    await Promise.all([
      supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
      supabase
        .from("quotations")
        .select(quoteSelect)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("leads")
        .select(
          "id, client_id, assigned_to_id, contact_id, active_deal_id, name, phone, email, project_type, status, is_archived"
        )
        .eq("client_id", clientId),
      supabase
        .from("deals")
        .select("id, name, service_summary, owner_id, contact_id, estimated_value, won_value, stage")
        .eq("client_id", clientId),
      supabase
        .from("users")
        .select("id, name, avatar_url, is_active")
        .eq("client_id", clientId),
      supabase
        .from("quote_templates")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("is_active", true),
      supabase.from("quotation_settings").select("*").eq("client_id", clientId).maybeSingle(),
    ]);

  const quoteRes = quoteFirst.error
    ? await supabase
        .from("quotations")
        .select(quoteSelectFallback)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
    : quoteFirst;

  if (!clientRes.data) throw new Error("Company not found");
  if (quoteRes.error) throw new Error(quoteRes.error.message);

  const quotes = (quoteRes.data ?? []) as DbQuote[];
  const leads = (leadRes.data ?? []) as DbLead[];
  const deals = (dealRes.data ?? []) as DbDeal[];
  const users = (userRes.data ?? []) as DbUser[];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
  const now = new Date();
  const settings = (settingsRes.data ?? null) as Partial<QuotationSettingsRow> | null;
  const visibility = resolveMarginVisibility(settings, isManager);
  const canSeeMargin = visibility === "percent" || visibility === "full";
  const canSeeCost = visibility === "full";
  const canSeeMarginPercent = canSeeMargin;

  const itemsByQuote = new Map<string, QuotationLineItemInput[]>();
  if (quotes.length > 0) {
    const quoteIds = quotes.map((quote) => quote.id);
    const itemRows: DbLine[] = [];
    const chunkSize = 200;
    for (let index = 0; index < quoteIds.length; index += chunkSize) {
      const chunk = quoteIds.slice(index, index + chunkSize);
      const rich = await supabase
        .from("quotation_line_items")
        .select(
          "quotation_id, unit_price, quantity, discount_percent, cost_price, catalog_unit_price, catalog_item_id, is_optional, item_name"
        )
        .in("quotation_id", chunk);
      const fallback = rich.error
        ? await supabase
            .from("quotation_line_items")
            .select("quotation_id, unit_price, quantity, item_name")
            .in("quotation_id", chunk)
        : rich;
      if (fallback.data) itemRows.push(...(fallback.data as DbLine[]));
    }

    for (const raw of itemRows) {
      const line: QuotationLineItemInput = {
        item_name: raw.item_name || "Item",
        unit_price: finiteMoney(raw.unit_price),
        quantity: finiteMoney(raw.quantity) || 1,
        discount_percent: finiteOrNull(raw.discount_percent) ?? 0,
        cost_price: finiteOrNull(raw.cost_price),
        catalog_unit_price: finiteOrNull(raw.catalog_unit_price),
        catalog_item_id: raw.catalog_item_id ?? null,
        is_optional: Boolean(raw.is_optional),
      };
      const list = itemsByQuote.get(raw.quotation_id) ?? [];
      list.push(line);
      itemsByQuote.set(raw.quotation_id, list);
    }
  }

  const rows: CompanyQuotationRow[] = quotes.map((quote) => {
    const lead = leadById.get(quote.lead_id);
    const deal = quote.deal_id ? dealById.get(quote.deal_id) : undefined;
    const ownerId = deal?.owner_id ?? lead?.assigned_to_id ?? quote.prepared_by_id;
    const ownerUser = ownerId ? userById.get(ownerId) : undefined;
    const owner: CompanyQuotationOwner | null = ownerId
      ? {
          id: ownerId,
          name:
            ownerUser?.name?.trim() ||
            (ownerId === quote.prepared_by_id ? quote.prepared_by_name?.trim() : null) ||
            "Unknown owner",
          avatarUrl: ownerUser?.avatar_url ?? null,
        }
      : quote.prepared_by_name?.trim()
        ? {
            id: `prepared-${quote.id}`,
            name: quote.prepared_by_name.trim(),
            avatarUrl: null,
          }
        : null;
    const status = (quote.status || "draft") as QuotationStatus;
    const customerName =
      quote.customer_name?.trim() || lead?.name?.trim() || "Unnamed customer";
    const dealValue = deal ? finiteMoney(deal.won_value ?? deal.estimated_value) : null;
    const items = itemsByQuote.get(quote.id) ?? [];
    const totals = computeQuotationTotals(items, {
      otherAmount: finiteMoney(quote.other_amount),
      discountPercent: finiteMoney(quote.discount_percent),
      fallbackTaxRate: finiteMoney(quote.tax_rate),
    });
    const governance = evaluateGovernance({
      items,
      totals,
      settings,
      role: actor.role,
    });
    const snapshot = quote.approval_snapshot ?? null;
    const snapshotMargin = snapshotNumber(snapshot, "marginPercent");
    const snapshotCost = snapshotNumber(snapshot, "costTotal");
    const snapshotDiscount = snapshotNumber(snapshot, "effectiveDiscountPercent");
    const snapshotHealth = snapshot?.marginHealth;
    const marginPercent = canSeeMargin
      ? snapshotMargin ?? (governance.costComplete ? governance.marginPercent : totals.marginPercent)
      : null;
    const costTotal = canSeeCost ? snapshotCost ?? (governance.costComplete ? totals.costTotal : null) : null;
    const marginHealth: MarginHealthState = canSeeMargin
      ? typeof snapshotHealth === "string"
        ? (snapshotHealth as MarginHealthState)
        : governance.marginHealth
      : "unknown";

    let standardValue: number | null = null;
    let standardSum = 0;
    let hasCatalog = false;
    for (const item of items) {
      if (item.is_optional) continue;
      if (item.catalog_unit_price != null) {
        hasCatalog = true;
        standardSum += Number(item.catalog_unit_price) * Number(item.quantity || 0);
      }
    }
    if (hasCatalog) standardValue = Math.round(standardSum * 100) / 100;

    const parent = quote.parent_quotation_id ? quoteById.get(quote.parent_quotation_id) : undefined;
    const selectedOptionId =
      quote.selected_offer_option_id ||
      quote.customer_configuration?.selected_offer_option_id ||
      null;
    const selectedOption =
      selectedOptionId && Array.isArray(quote.offer_options)
        ? quote.offer_options.find((option) => option.id === selectedOptionId)
        : null;

    return {
      id: quote.id,
      clientId: quote.client_id,
      leadId: quote.lead_id,
      contactId: deal?.contact_id ?? lead?.contact_id ?? null,
      dealId: quote.deal_id,
      quoteNumber: quote.quote_number,
      revisionNumber: Number(quote.revision_number) || 1,
      title:
        deal?.service_summary?.trim() ||
        lead?.project_type?.trim() ||
        deal?.name?.trim() ||
        "Quotation",
      customerName,
      customerPhone: quote.customer_phone ?? lead?.phone ?? null,
      customerEmail: quote.customer_email ?? lead?.email ?? null,
      dealName: deal?.name?.trim() || null,
      dealStage: deal?.stage ?? null,
      dealValue: dealValue != null && Number.isFinite(dealValue) ? dealValue : null,
      amount: finiteMoney(quote.total),
      currency: quote.currency?.trim() || "USD",
      status,
      effectiveStatus: effectiveQuoteStatus(status, quote.valid_until, now),
      owner,
      preparedByName: quote.prepared_by_name,
      quoteDate: quote.sent_at ?? quote.created_at,
      validUntil: quote.valid_until,
      sentAt: quote.sent_at,
      viewedAt: quote.viewed_at,
      lastViewedAt: quote.last_viewed_at ?? quote.viewed_at,
      viewCount: Number(quote.view_count) || 0,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      publicToken: quote.public_token,
      approvalStatus: quote.approval_status ?? "not_required",
      approvalNote: quote.approval_note ?? null,
      approvalReasons: parseReasons(quote.approval_required_reasons),
      approvalRequestedAt: quote.approval_requested_at ?? null,
      approvedAt: quote.approved_at ?? null,
      approvedByName: quote.approved_by_id
        ? userById.get(quote.approved_by_id)?.name ?? null
        : null,
      discountPercent:
        snapshotDiscount ??
        (quote.discount_percent != null ? Number(quote.discount_percent) : totals.effectiveDiscountPercent || null),
      discountExceedsAuthority: !governance.discountWithinAuthority,
      maxDiscountPercent: governance.maxDiscountPercent,
      minMarginPercent:
        settings && settings.min_margin_percent != null ? Number(settings.min_margin_percent) : null,
      marginPercent,
      marginHealth,
      costTotal,
      standardValue,
      subtotal: finiteOrNull(quote.subtotal) ?? totals.subtotal,
      taxAmount: finiteOrNull(quote.tax_amount) ?? totals.taxAmount,
      otherAmount: finiteOrNull(quote.other_amount),
      customerResponseType: quote.customer_response_type ?? null,
      customerResponseCategory: quote.customer_response_category ?? null,
      customerResponseMessage: quote.customer_response_message ?? null,
      acceptedTotal: finiteOrNull(quote.accepted_total),
      declinedReason: quote.declined_reason ?? null,
      parentQuotationId: quote.parent_quotation_id ?? null,
      previousVersion: parent
        ? {
            id: parent.id,
            revisionNumber: Number(parent.revision_number) || 1,
            amount: finiteMoney(parent.total),
            status: String(parent.status || ""),
          }
        : null,
      selectedOptionLabel: selectedOption?.label ?? null,
    };
  });

  const counts = emptyCompanyQuotationCounts();
  counts.all = rows.length;
  for (const tab of Object.keys(counts) as Array<keyof typeof counts>) {
    if (tab === "all") continue;
    counts[tab] = rows.filter((row) => companyQuotationMatchesTab(row, tab, now)).length;
  }

  const owners = Array.from(
    new Map(
      rows
        .map((row) => row.owner)
        .filter((owner): owner is CompanyQuotationOwner => Boolean(owner))
        .map((owner) => [owner.id, owner])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const customers = Array.from(
    new Map(
      rows.map((row) => [
        row.contactId ?? `name:${labelForCustomer(row).toLowerCase()}`,
        {
          id: row.contactId ?? `name:${labelForCustomer(row).toLowerCase()}`,
          label: labelForCustomer(row),
        },
      ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const dealOptions = Array.from(
    new Map(
      rows
        .filter((row) => row.dealId && row.dealName)
        .map((row) => [row.dealId!, { id: row.dealId!, label: row.dealName! }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  const createCandidates = leads
    .filter(
      (lead) =>
        !lead.is_archived &&
        lead.status !== "LOST" &&
        lead.status !== "NOT_QUALIFIED"
    )
    .slice(0, 200)
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      projectType: lead.project_type,
      clientId: lead.client_id,
      status: lead.status,
    }));

  const currencies = Array.from(new Set(rows.map((row) => row.currency).filter(Boolean))).sort();
  const permissions: CompanyQuotationPermissions = {
    alsoSells: Boolean(actor.alsoSells),
    canApprove: isManager,
    canSeeMargin,
    canSeeCost,
    canSeeMarginPercent,
    canManageSettings: isManager,
  };

  return {
    clientId,
    clientName: String(clientRes.data.name || "Company"),
    currency: rows.find((row) => row.currency)?.currency || "USD",
    currencies,
    viewedTrackingEnabled: true,
    rows,
    counts,
    attention: companyQuotationAttention(rows, now),
    totalValue: rows.reduce((sum, row) => sum + row.amount, 0),
    owners,
    customers,
    deals: dealOptions,
    hasTemplates: (templateRes.count ?? 0) > 0,
    permissions,
    createCandidates,
  };
}
