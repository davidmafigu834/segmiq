import type { SupabaseClient } from "@supabase/supabase-js";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import { isQuotationEditable } from "@/lib/quotations/lifecycle";
import {
  priceEditPolicy,
  resolveMarginVisibility,
  salespersonMayDiscount,
  salespersonMayEditCatalogPrice,
  stripCostFromUnknown,
} from "@/lib/quotations/governance";
import {
  actorCanApproveTargets,
  awaitingApproverLabel,
  targetsFromUnknownRules,
} from "@/lib/quotations/approver-authority";
import type {
  QuotationApprovalPolicyRow,
  QuotationEventRow,
  QuotationRow,
  QuotationLineItemRow,
  QuotationSettingsRow,
} from "@/types";

export type WorkspaceLinkedDeal = {
  id: string;
  title: string;
  stage: string | null;
  value: number | null;
  ownerId: string | null;
};

export type WorkspaceLinkedCustomer = {
  name: string;
  phone: string | null;
  email: string | null;
  hasWhatsApp: boolean;
  leadId: string;
  contactId: string | null;
};

export type WorkspaceVersionSummary = {
  id: string;
  revision_number: number;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  prepared_by_name: string | null;
  revision_note: string | null;
  sent_at: string | null;
};

export type QuotationWorkspacePayload = {
  quotation: QuotationRow & { items: QuotationLineItemRow[] };
  customer: WorkspaceLinkedCustomer;
  deal: WorkspaceLinkedDeal | null;
  companyName: string | null;
  owner: { id: string | null; name: string };
  settings: Partial<QuotationSettingsRow> | null;
  policies: QuotationApprovalPolicyRow[];
  versions: WorkspaceVersionSummary[];
  events: QuotationEventRow[];
  permissions: {
    canEdit: boolean;
    canSend: boolean;
    canApprove: boolean;
    canDecideApproval: boolean;
    canSeeMargin: boolean;
    canSeeCost: boolean;
    canSeeMarginPercent: boolean;
    canSeeMarginHealth: boolean;
    canDeleteDraft: boolean;
    canCustomItems: boolean;
    canEditCatalogPrice: boolean;
    canApplyDiscount: boolean;
    canCreatePackage: boolean;
    canCreateTemplate: boolean;
    canCopySecureLink: boolean;
    canRevokeSecureLink: boolean;
    awaitingApproverLabel: string | null;
  };
  marginVisibility: "none" | "health" | "percent" | "full";
  commercialFlags: {
    productPickerV2: boolean;
  };
};

async function resolveUserName(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<{ id: string | null; name: string | null }> {
  if (!userId) return { id: null, name: null };
  const { data } = await supabase.from("users").select("id, name").eq("id", userId).maybeSingle();
  if (!data) return { id: userId, name: null };
  const name = ((data.name as string) || "").trim();
  return { id: data.id as string, name: name || null };
}

export async function loadQuotationWorkspace(
  supabase: SupabaseClient,
  quotationId: string,
  opts: {
    role: string;
    userId: string;
  }
): Promise<QuotationWorkspacePayload | null> {
  const full = await loadQuotationWithItems(supabase, quotationId);
  if (!full) return null;

  const quote = full as unknown as QuotationRow & { items: QuotationLineItemRow[] };
  const leadId = quote.lead_id;

  const [{ data: lead }, { data: client }, { data: settings }, { data: policies }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, email, contact_id, assigned_to_id, project_type, active_deal_id")
      .eq("id", leadId)
      .maybeSingle(),
    supabase.from("clients").select("id, name, commercial_flags").eq("id", quote.client_id).maybeSingle(),
    supabase.from("quotation_settings").select("*").eq("client_id", quote.client_id).maybeSingle(),
    supabase
      .from("quotation_approval_policies")
      .select("*")
      .eq("client_id", quote.client_id)
      .eq("is_active", true)
      .order("priority", { ascending: true }),
  ]);

  let deal: WorkspaceLinkedDeal | null = null;
  const dealId = quote.deal_id || (lead?.active_deal_id as string | null);
  if (dealId) {
    const { data: d } = await supabase
      .from("deals")
      .select("id, name, stage, estimated_value, won_value, service_summary, owner_id")
      .eq("id", dealId)
      .maybeSingle();
    if (d) {
      deal = {
        id: d.id as string,
        title: (d.name as string) || (d.service_summary as string) || "Deal",
        stage: (d.stage as string) || null,
        value:
          d.won_value != null
            ? Number(d.won_value)
            : d.estimated_value != null
              ? Number(d.estimated_value)
              : null,
        ownerId: (d.owner_id as string) || null,
      };
    }
  }

  // Owner: quotation preparer → Deal owner → lead assignee → Unassigned (never "Unknown")
  const prepared = await resolveUserName(supabase, quote.prepared_by_id);
  const dealOwner = deal?.ownerId ? await resolveUserName(supabase, deal.ownerId) : null;
  const leadOwner = await resolveUserName(supabase, lead?.assigned_to_id as string | null);

  const ownerName =
    (quote.prepared_by_name || "").trim() ||
    prepared.name ||
    dealOwner?.name ||
    leadOwner.name ||
    null;
  const ownerId =
    quote.prepared_by_id || prepared.id || dealOwner?.id || leadOwner.id || null;

  const owner = {
    id: ownerId,
    name:
      ownerName && ownerName !== "Unknown"
        ? ownerName
        : ownerId
          ? "Unassigned"
          : "Unassigned",
  };
  if (owner.name === "Unknown") owner.name = "Unassigned";

  const versions: WorkspaceVersionSummary[] = [];
  const rootId = quote.parent_quotation_id || quote.id;
  const { data: chain } = await supabase
    .from("quotations")
    .select(
      "id, revision_number, status, total, currency, created_at, prepared_by_name, revision_note, sent_at, parent_quotation_id, superseded_by_id"
    )
    .or(`id.eq.${rootId},parent_quotation_id.eq.${rootId}`)
    .order("revision_number", { ascending: true });

  for (const v of chain ?? []) {
    versions.push({
      id: v.id as string,
      revision_number: Number(v.revision_number) || 1,
      status: v.status as string,
      total: Number(v.total) || 0,
      currency: (v.currency as string) || "USD",
      created_at: v.created_at as string,
      prepared_by_name: (v.prepared_by_name as string) || null,
      revision_note: (v.revision_note as string) || null,
      sent_at: (v.sent_at as string) || null,
    });
  }
  if (versions.length === 0) {
    versions.push({
      id: quote.id,
      revision_number: quote.revision_number || 1,
      status: quote.status,
      total: Number(quote.total) || 0,
      currency: quote.currency || "USD",
      created_at: quote.created_at,
      prepared_by_name: quote.prepared_by_name,
      revision_note: quote.revision_note ?? null,
      sent_at: quote.sent_at,
    });
  }

  let events: QuotationEventRow[] = [];
  const { data: ev, error: evErr } = await supabase
    .from("quotation_events")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!evErr && ev) events = ev as QuotationEventRow[];

  const isManager = opts.role === "CLIENT_MANAGER" || opts.role === "SUPER_ADMIN";
  const pendingApproval =
    quote.approval_status === "pending" || quote.status === "pending_approval";
  let canDecideApproval = isManager && pendingApproval;
  let approverLabel: string | null = pendingApproval ? awaitingApproverLabel([]) : null;
  if (pendingApproval) {
    const { data: requests } = await supabase
      .from("quotation_approval_requests")
      .select("id, triggered_rules")
      .eq("quotation_id", quotationId)
      .eq("status", "pending");
    const requestIds = (requests ?? []).map((row) => row.id as string);
    let targets = (requests ?? []).flatMap((row) => targetsFromUnknownRules(row.triggered_rules));
    if (requestIds.length > 0) {
      const { data: steps } = await supabase
        .from("quotation_approval_steps")
        .select("approver_role, approver_user_id, status")
        .in("request_id", requestIds)
        .eq("status", "pending");
      if (steps && steps.length > 0) {
        targets = steps.map((step) => ({
          approverRole: (step.approver_role as string | null) ?? null,
          approverUserId: (step.approver_user_id as string | null) ?? null,
        }));
      }
    }
    canDecideApproval = actorCanApproveTargets({ id: opts.userId, role: opts.role }, targets);
    approverLabel = awaitingApproverLabel(targets);
  }
  const s = (settings ?? {}) as Partial<QuotationSettingsRow>;
  const vis = resolveMarginVisibility(s, isManager);
  const canSeeMargin = vis === "percent" || vis === "full";
  const canSeeCost = vis === "full";
  const canSeeMarginHealth = vis !== "none";
  const policy = priceEditPolicy(s);

  const phone = (quote.customer_phone || lead?.phone || null) as string | null;

  const payload: QuotationWorkspacePayload = {
    quotation: canSeeCost ? quote : stripCostFromUnknown(quote, false),
    customer: {
      name: (quote.customer_name || lead?.name || "Customer") as string,
      phone,
      email: (quote.customer_email || lead?.email || null) as string | null,
      hasWhatsApp: Boolean(phone),
      leadId,
      contactId: (lead?.contact_id as string) || null,
    },
    deal,
    companyName: (client?.name as string) || null,
    owner,
    settings: canSeeCost ? s : stripCostFromUnknown(s, false),
    policies: (policies ?? []) as QuotationApprovalPolicyRow[],
    versions,
    events: evErr ? [] : (events as QuotationEventRow[]),
    marginVisibility: vis,
    permissions: {
      canEdit: isQuotationEditable(quote.status),
      canSend: ["draft", "approved", "sent", "viewed", "pending_approval"].includes(quote.status),
      canApprove: isManager,
      canDecideApproval,
      canSeeMargin,
      canSeeCost,
      canSeeMarginPercent: canSeeMargin,
      canSeeMarginHealth,
      canDeleteDraft: quote.status === "draft" && (quote.approval_status === "not_required" || quote.approval_status === "rejected" || quote.approval_status === "changes_requested" || !quote.approval_status),
      canCustomItems: isManager || s.salesperson_can_create_custom_item !== false,
      canEditCatalogPrice: salespersonMayEditCatalogPrice(policy, isManager),
      canApplyDiscount: salespersonMayDiscount(policy, isManager),
      canCreatePackage: isManager || Boolean(s.salesperson_can_create_package),
      canCreateTemplate: isManager,
      canCopySecureLink: Boolean(quote.public_token) && !quote.link_revoked_at,
      canRevokeSecureLink: isManager && Boolean(quote.public_token) && !quote.link_revoked_at,
      awaitingApproverLabel: approverLabel,
    },
    commercialFlags: {
      productPickerV2: (client as { commercial_flags?: Record<string, unknown> } | null)?.commercial_flags?.[
        "quotation.productPickerV2"
      ] !== false,
    },
  };

  return payload;
}
