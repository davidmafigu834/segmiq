import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import {
  ContactProfileView,
  type ContactProfileData,
  type ContactProfileLead,
} from "@/components/customer-hub/ContactProfileView";
import { normalizeLegacyLifecycle } from "@/lib/customer-hub/lifecycle";

export const dynamic = "force-dynamic";

const CLOSED_STATUSES = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

type LeadRow = {
  id: string;
  status: string;
  source: string | null;
  deal_value: number | null;
  project_type: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: { id: string; name: string } | { id: string; name: string }[] | null;
};

function unwrapAssignee(
  raw: LeadRow["assigned_to"]
): { id: string; name: string } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function mapLead(row: LeadRow): ContactProfileLead {
  const assignee = unwrapAssignee(row.assigned_to);
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    deal_value: row.deal_value,
    project_type: row.project_type,
    follow_up_date: row.follow_up_date,
    created_at: row.created_at,
    assigneeId: assignee?.id ?? null,
    assigneeName: assignee?.name ?? null,
  };
}

export default async function ContactProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "AGENCY_ADMIN") redirect("/login");

  const supabase = createAdminClient();

  const [{ data: contact }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, client_id, name, phone, email, source, lifecycle, lead_origin, notes, created_at, updated_at, interested_listing_ids, buyer_budget_min, buyer_budget_max, buyer_bedrooms_wanted, buyer_area_preference, buyer_timeline")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  if (!contact) notFound();
  if (session.role !== "AGENCY_ADMIN" && contact.client_id !== session.clientId) notFound();

  const contactClientId = contact.client_id as string;

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, assignment_mode, dial_code, business_type")
    .eq("id", contactClientId)
    .maybeSingle();

  const { data: leadRows } = await supabase
    .from("leads")
    .select(
      "id, status, source, deal_value, project_type, follow_up_date, created_at, updated_at, assigned_to:users!assigned_to_id ( id, name )"
    )
    .eq("contact_id", contact.id)
    .order("created_at", { ascending: false });

  const leads = ((leadRows ?? []) as LeadRow[]).map(mapLead);
  const activeLead = leads.find((l) => !CLOSED_STATUSES.has(l.status)) ?? null;
  const leadIds = leads.map((l) => l.id);

  let callCount = 0;
  let lastActivityAt: string | null = contact.updated_at as string;
  let lastHandlerName: string | null = null;

  if (leadIds.length) {
    const { data: callLogs } = await supabase
      .from("call_logs")
      .select("created_at, user_id, users ( name )")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    callCount = callLogs?.length ?? 0;
    const latestLog = callLogs?.[0];
    if (latestLog?.created_at) {
      const logAt = latestLog.created_at as string;
      if (!lastActivityAt || new Date(logAt) > new Date(lastActivityAt)) {
        lastActivityAt = logAt;
        const u = latestLog.users as { name?: string } | { name?: string }[] | null | undefined;
        lastHandlerName = Array.isArray(u) ? (u[0]?.name ?? null) : (u?.name ?? null);
      }
    }

    for (const lead of leadRows ?? []) {
      const updated = lead.updated_at as string;
      if (updated && (!lastActivityAt || new Date(updated) > new Date(lastActivityAt))) {
        lastActivityAt = updated;
        lastHandlerName = unwrapAssignee((lead as LeadRow).assigned_to)?.name ?? lastHandlerName;
      }
    }
  }

  const wonValue = leads.reduce((sum, l) => {
    if (l.status !== "WON") return sum;
    return sum + (l.deal_value != null ? Number(l.deal_value) : 0);
  }, 0);

  const profileData: ContactProfileData = {
    contact: {
      id: contact.id as string,
      name: contact.name as string | null,
      phone: contact.phone as string | null,
      email: contact.email as string | null,
      source: contact.source as string | null,
      notes: contact.notes as string | null,
      lifecycle: normalizeLegacyLifecycle(contact.lifecycle as string),
      leadOrigin: contact.lead_origin as string,
      createdAt: contact.created_at as string,
      interestedListingIds: Array.isArray(contact.interested_listing_ids)
        ? (contact.interested_listing_ids as string[])
        : [],
      buyerBudgetMin: contact.buyer_budget_min != null ? Number(contact.buyer_budget_min) : null,
      buyerBudgetMax: contact.buyer_budget_max != null ? Number(contact.buyer_budget_max) : null,
      buyerBedroomsWanted:
        contact.buyer_bedrooms_wanted != null ? Number(contact.buyer_bedrooms_wanted) : null,
      buyerAreaPreference: (contact.buyer_area_preference as string | null) ?? null,
      buyerTimeline: (contact.buyer_timeline as string | null) ?? null,
    },
    stats: {
      totalDeals: leads.length,
      activeDeals: leads.filter((l) => !CLOSED_STATUSES.has(l.status)).length,
      wonValue,
      callCount,
      lastActivityAt,
      lastHandlerName,
    },
    activeLead,
    leads,
    clientId: contactClientId,
    clientName: (clientRow?.name as string) ?? "Your company",
    clientDialCode: (clientRow?.dial_code as string) ?? "263",
    assignmentMode:
      (clientRow?.assignment_mode as "direct" | "pool" | "round_robin" | null) ?? "direct",
    businessType: (clientRow?.business_type as "trades" | "real_estate" | null) ?? "trades",
  };

  return (
    <ClientManagerLayout breadcrumbPage="CONTACT" pageTitle="Customer Hub" hideShellHeader>
      <div className="px-0">
        <ContactProfileView data={profileData} />
      </div>
    </ClientManagerLayout>
  );
}
