import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { PipelinePageShell } from "@/components/sales/pipeline/PipelinePageShell";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { adaptDealToCalendarEvent, adaptLeadsToCalendarEvents } from "@/lib/sales/calendar/adapters";
import { locationFromFormData } from "@/lib/sales/calendar/location";
import type { CalendarDealOption, CalendarLeadRow } from "@/lib/sales/calendar/types";
import { SalesCalendarPage } from "@/components/sales/calendar/SalesCalendarPage";
import type { PriorityLead } from "@/lib/sales-priority-lead";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const LEAD_SELECT =
  "id, name, phone, follow_up_date, status, source, project_type, form_data, client_id, created_at, email, budget, timeline, is_stale, score, contact_id";

type DbLead = {
  id: string;
  name: string | null;
  phone: string | null;
  follow_up_date: string | null;
  status: string | null;
  source: string | null;
  project_type: string | null;
  form_data: Record<string, unknown> | null;
  client_id: string;
  created_at: string;
  email?: string | null;
  budget?: string | null;
  timeline?: string | null;
  is_stale?: boolean | null;
  score?: number | null;
  contact_id?: string | null;
};

export default async function SalesCalendarRoutePage({
  searchParams,
}: {
  searchParams?: { deal?: string; lead?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canActAsSalesperson(session)) redirect("/login");

  const supabase = createAdminClient();

  const [scheduledRes, allLeadsRes, dealsRes, navBadges] = await Promise.all([
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("assigned_to_id", session.userId)
      .not("follow_up_date", "is", null)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("follow_up_date", { ascending: true }),
    supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("assigned_to_id", session.userId)
      .or("is_archived.is.null,is_archived.eq.false")
      .in("status", ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"])
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("deals")
      .select("id, name, originating_lead_id, owner_id, stage, next_action_at, next_action_label, contact_id")
      .eq("owner_id", session.userId)
      .not("stage", "in", '("WON","LOST")')
      .order("updated_at", { ascending: false })
      .limit(200),
    fetchSalesNavBadges(session.userId, session.clientId ?? null),
  ]);

  let scheduledLeads = (scheduledRes.data ?? []) as DbLead[];
  if (
    scheduledRes.error &&
    String(scheduledRes.error.message || "").includes("column leads.is_archived does not exist")
  ) {
    const retry = await supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("assigned_to_id", session.userId)
      .not("follow_up_date", "is", null)
      .order("follow_up_date", { ascending: true });
    scheduledLeads = (retry.data ?? []) as DbLead[];
  }

  let allLeads = (allLeadsRes.data ?? []) as DbLead[];
  if (
    allLeadsRes.error &&
    String(allLeadsRes.error.message || "").includes("column leads.is_archived does not exist")
  ) {
    const retry = await supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("assigned_to_id", session.userId)
      .in("status", ["NEW", "CONTACTED", "NEGOTIATING", "PROPOSAL_SENT"])
      .order("updated_at", { ascending: false })
      .limit(200);
    allLeads = (retry.data ?? []) as DbLead[];
  }

  type DbDeal = {
    id: string;
    name: string;
    originating_lead_id: string;
    owner_id: string | null;
    stage: string | null;
    next_action_at: string | null;
    next_action_label: string | null;
    contact_id: string | null;
  };
  let ownedDeals = (dealsRes.data ?? []) as DbDeal[];
  const presetDealId = searchParams?.deal?.trim() || null;
  const presetLeadId = searchParams?.lead?.trim() || null;
  if (presetDealId && !ownedDeals.some((deal) => deal.id === presetDealId)) {
    const extra = await supabase
      .from("deals")
      .select("id, name, originating_lead_id, owner_id, stage, next_action_at, next_action_label, contact_id")
      .eq("id", presetDealId)
      .eq("owner_id", session.userId)
      .maybeSingle();
    if (extra.data) ownedDeals = [extra.data as DbDeal, ...ownedDeals];
  }

  const leadIds = scheduledLeads.map((l) => l.id);
  const contactIds = Array.from(
    new Set(
      scheduledLeads.map((l) => l.contact_id).filter((id): id is string => Boolean(id))
    )
  );

  const [callbackAtByLeadId, quoteRows, contactRows] = await Promise.all([
    fetchLatestScheduledCallbacksByLeadId(supabase, leadIds),
    leadIds.length
      ? supabase
          .from("quotations")
          .select("lead_id, quote_number, status, total, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contactIds.length
      ? supabase.from("contacts").select("id, location").in("id", contactIds)
      : Promise.resolve({ data: [] as Array<{ id: string; location: string | null }> }),
  ]);

  const contactLocationById = new Map<string, string | null>();
  for (const c of contactRows.data ?? []) {
    contactLocationById.set(c.id as string, (c.location as string | null) ?? null);
  }

  const latestQuoteByLead = new Map<
    string,
    { quote_number: string | null; status: string | null; total: number | null }
  >();
  for (const q of quoteRows.data ?? []) {
    const lid = q.lead_id as string;
    if (latestQuoteByLead.has(lid)) continue;
    latestQuoteByLead.set(lid, {
      quote_number: (q.quote_number as string | null) ?? null,
      status: (q.status as string | null) ?? null,
      total: typeof q.total === "number" ? q.total : Number(q.total) || null,
    });
  }

  const calendarLeads: CalendarLeadRow[] = scheduledLeads.map((lead) => {
    const quote = latestQuoteByLead.get(lead.id);
    const contactLoc = lead.contact_id
      ? contactLocationById.get(lead.contact_id)?.trim() || null
      : null;
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      location: contactLoc || locationFromFormData(lead.form_data),
      follow_up_date: lead.follow_up_date,
      status: lead.status,
      source: lead.source,
      project_type: lead.project_type,
      form_data: lead.form_data,
      score: typeof lead.score === "number" ? lead.score : null,
      latestQuoteNumber: quote?.quote_number ?? null,
      latestQuoteStatus: quote?.status ?? null,
      latestQuoteTotal: quote?.total ?? null,
    };
  });

  const initialLeadEvents = adaptLeadsToCalendarEvents(calendarLeads, callbackAtByLeadId);

  const phoneByLeadId = new Map<string, string | null>();
  for (const lead of [...scheduledLeads, ...allLeads]) {
    phoneByLeadId.set(lead.id, lead.phone);
  }
  const missingDealLeadIds = Array.from(
    new Set(
      ownedDeals
        .map((deal) => deal.originating_lead_id)
        .filter((id) => id && !phoneByLeadId.has(id))
    )
  );
  if (missingDealLeadIds.length) {
    const extraLeadPhones = await supabase
      .from("leads")
      .select("id, phone")
      .in("id", missingDealLeadIds);
    for (const row of extraLeadPhones.data ?? []) {
      phoneByLeadId.set(row.id as string, (row.phone as string | null) ?? null);
    }
  }

  const scheduleableDeals: CalendarDealOption[] = ownedDeals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    originatingLeadId: deal.originating_lead_id,
    phone: phoneByLeadId.get(deal.originating_lead_id) ?? null,
    nextActionAt: deal.next_action_at,
    nextActionLabel: deal.next_action_label,
    stage: deal.stage,
  }));
  const dealLeadIdsWithAction = new Set(
    scheduleableDeals.filter((deal) => deal.nextActionAt).map((deal) => deal.originatingLeadId)
  );
  const dealEvents = scheduleableDeals
    .map((deal) => adaptDealToCalendarEvent(deal))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const initialEvents = [...initialLeadEvents.filter((event) => !dealLeadIdsWithAction.has(event.leadId)), ...dealEvents]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const scheduleableLeads: PriorityLead[] = allLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? null,
    status: lead.status ?? "NEW",
    score: lead.score ?? null,
    is_stale: lead.is_stale ?? null,
    budget: lead.budget ?? null,
    project_type: lead.project_type,
    timeline: lead.timeline ?? null,
    form_data: lead.form_data,
    created_at: lead.created_at,
    follow_up_date: lead.follow_up_date,
    followUpDue: false,
    priorityLabel: "",
    priorityColor: "",
    priorityOrder: 0,
    client_id: lead.client_id,
    source: lead.source,
  }));

  let unread = 0;
  let avatarUrl: string | null = null;
  try {
    const [unreadRes, userRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.userId)
        .eq("read", false),
      supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    ]);
    unread = unreadRes.count ?? 0;
    avatarUrl = (userRes.data?.avatar_url as string | null) ?? null;
  } catch {
    unread = 0;
  }

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);
  const tasksBadge = navBadges.followUpsToday || navBadges.callNow || 0;

  return (
    <SalesLayout
      breadcrumb="SALES / CALENDAR"
      pageTitle="Calendar"
      hideShellHeader
      hideShellSidebar
      contentFlush
    >
      <PipelinePageShell
        userName={session.user?.name ?? "Sales"}
        avatarUrl={avatarUrl}
        unreadNotifications={unread}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
        tasksBadge={tasksBadge}
        isSolo={session.clientMode === "solo"}
        breadcrumb="SALES / CALENDAR"
        title="Calendar"
        description="Plan follow-ups, site visits, calls, and quote meetings."
        dense
      >
        <SalesCalendarPage
          initialEvents={initialEvents}
          scheduleableLeads={scheduleableLeads}
          scheduleableDeals={scheduleableDeals}
          presetDealId={presetDealId}
          presetLeadId={presetLeadId}
        />
      </PipelinePageShell>
    </SalesLayout>
  );
}
