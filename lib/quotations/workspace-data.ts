import type { SupabaseClient } from "@supabase/supabase-js";
import { loadQuotationWithItems } from "@/lib/quotations/persist";
import type {
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
  owner: { id: string | null; name: string | null };
  settings: Partial<QuotationSettingsRow> | null;
  versions: WorkspaceVersionSummary[];
  events: QuotationEventRow[];
  permissions: {
    canEdit: boolean;
    canSend: boolean;
    canApprove: boolean;
    canSeeMargin: boolean;
    canSeeCost: boolean;
    canDeleteDraft: boolean;
    canCustomItems: boolean;
  };
};

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

  const quote = full as QuotationRow & { items: QuotationLineItemRow[] };
  const leadId = quote.lead_id;

  const [{ data: lead }, { data: client }, { data: settings }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, email, contact_id, assigned_to_id, project_type, active_deal_id")
      .eq("id", leadId)
      .maybeSingle(),
    supabase.from("clients").select("id, name").eq("id", quote.client_id).maybeSingle(),
    supabase.from("quotation_settings").select("*").eq("client_id", quote.client_id).maybeSingle(),
  ]);

  let deal: WorkspaceLinkedDeal | null = null;
  const dealId = quote.deal_id || (lead?.active_deal_id as string | null);
  if (dealId) {
    const { data: d } = await supabase
      .from("deals")
      .select("id, name, stage, estimated_value, won_value, service_summary")
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
      };
    }
  }

  // Version chain: walk parent or find siblings by base number
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
  const s = (settings ?? {}) as Partial<QuotationSettingsRow>;
  const canSeeMargin = isManager || Boolean(s.salesperson_can_see_margin);
  const canSeeCost = isManager || Boolean(s.salesperson_can_see_cost);

  const phone = (quote.customer_phone || lead?.phone || null) as string | null;

  return {
    quotation: quote,
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
    owner: {
      id: quote.prepared_by_id,
      name: quote.prepared_by_name,
    },
    settings: s,
    versions,
    events,
    permissions: {
      canEdit: quote.status === "draft",
      canSend: ["draft", "approved", "sent", "viewed"].includes(quote.status),
      canApprove: isManager,
      canSeeMargin,
      canSeeCost,
      canDeleteDraft: quote.status === "draft",
      canCustomItems: true,
    },
  };
}
