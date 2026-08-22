import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveQuoteStatus } from "@/lib/sales/quotes/format";
import type { QuotationStatus, UserRole } from "@/types";
import type {
  CompanyQuotationOwner,
  CompanyQuotationRow,
  CompanyQuotationTab,
  CompanyQuotationsPageData,
} from "@/components/dashboard/company/quotations/types";

type Actor = {
  userId: string;
  role: UserRole;
  clientId: string | null;
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
  currency: string | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
  public_token: string | null;
  approval_status?: string | null;
  approval_note?: string | null;
  discount_percent?: number | null;
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
};

type DbUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
};

function finiteMoney(value: number | string | null | undefined): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function labelForCustomer(row: CompanyQuotationRow): string {
  return row.customerName.trim() || "Unnamed customer";
}

/**
 * Company-wide quotation workspace data.
 *
 * Definitions:
 * - Status counts use the canonical quotation status after date-based expiry.
 * - Viewed is supported because public quotation links persist `viewed_at`.
 * - Total Value is the sum of all non-deleted quotation grand totals, across statuses.
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
  const [clientRes, quoteRes, leadRes, dealRes, userRes, templateRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase
      .from("quotations")
      .select(
        "id, client_id, lead_id, deal_id, quote_number, revision_number, status, customer_name, customer_phone, customer_email, total, currency, valid_until, sent_at, viewed_at, created_at, updated_at, public_token, prepared_by_id, prepared_by_name, approval_status, approval_note, discount_percent"
      )
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
      .select("id, name, service_summary, owner_id, contact_id, estimated_value, won_value")
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
  ]);

  if (!clientRes.data) throw new Error("Company not found");
  if (quoteRes.error) throw new Error(quoteRes.error.message);

  const quotes = (quoteRes.data ?? []) as DbQuote[];
  const leads = (leadRes.data ?? []) as DbLead[];
  const deals = (dealRes.data ?? []) as DbDeal[];
  const users = (userRes.data ?? []) as DbUser[];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const now = new Date();

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
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      publicToken: quote.public_token,
      approvalStatus: quote.approval_status ?? null,
      approvalNote: quote.approval_note ?? null,
      discountPercent: quote.discount_percent != null ? Number(quote.discount_percent) : null,
    };
  });

  const counts: Record<CompanyQuotationTab, number> = {
    all: rows.length,
    draft: rows.filter((row) => row.effectiveStatus === "draft").length,
    sent: rows.filter((row) => row.effectiveStatus === "sent").length,
    viewed: rows.filter((row) => row.effectiveStatus === "viewed").length,
    accepted: rows.filter((row) => row.effectiveStatus === "accepted").length,
    declined: rows.filter((row) => row.effectiveStatus === "rejected").length,
    pending_approval: rows.filter((row) => row.approvalStatus === "pending" || row.status === "pending_approval").length,
    expired: rows.filter((row) => row.effectiveStatus === "expired").length,
  };

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
      rows.map((row) => [row.contactId ?? `name:${labelForCustomer(row).toLowerCase()}`, {
        id: row.contactId ?? `name:${labelForCustomer(row).toLowerCase()}`,
        label: labelForCustomer(row),
      }])
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

  return {
    clientId,
    clientName: String(clientRes.data.name || "Company"),
    currency: rows.find((row) => row.currency)?.currency || "USD",
    viewedTrackingEnabled: true,
    rows,
    counts,
    totalValue: rows.reduce((sum, row) => sum + row.amount, 0),
    owners,
    customers,
    deals: dealOptions,
    hasTemplates: (templateRes.count ?? 0) > 0,
    createCandidates,
  };
}
