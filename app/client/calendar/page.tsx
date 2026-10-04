import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSalesTimezone, planDateInTimezone } from "@/lib/sales/intelligence/timezone";
import { companyCalendarQueryRange } from "@/lib/sales/company-calendar/format";
import { getCompanyCalendarData } from "@/lib/sales/get-company-calendar-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { isRealEstate } from "@/lib/terminology";
import { listOperationalCalendar } from "@/lib/work-projects/field-service";
import type { CompanyCalendarEvent } from "@/lib/sales/company-calendar/types";
import { CompanyCalendarPage } from "@/components/dashboard/company/calendar/CompanyCalendarPage";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function safeDateKey(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : fallback;
}

export default async function CompanyCalendarRoute({
  searchParams,
}: {
  searchParams: { clientId?: string; date?: string; view?: string; event?: string; owner?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN") {
    redirect("/sales/calendar");
  }

  const clientId =
    session.role === "SUPER_ADMIN" ? searchParams.clientId || session.clientId : session.clientId;
  if (!clientId) redirect(session.role === "SUPER_ADMIN" ? "/dashboard" : "/login");

  const supabase = createAdminClient();
  const { data: agencySettings } = await supabase
    .from("agency_settings")
    .select("default_timezone")
    .eq("id", "singleton")
    .maybeSingle();
  const timezone = resolveSalesTimezone(
    (agencySettings as { default_timezone?: string | null } | null)?.default_timezone
  );
  const todayKey = planDateInTimezone(new Date(), timezone);
  const anchorKey = safeDateKey(searchParams.date, todayKey);
  const queryRange = companyCalendarQueryRange(anchorKey);
  const salespersonCapability = canActAsSalesperson(session);

  const [data, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyCalendarData({
      clientId,
      rangeStartKey: queryRange.startKey,
      rangeEndKey: queryRange.endKey,
      actorId: session.userId,
      timezone,
      canManageAny: true,
      canActAsSalesperson: salespersonCapability,
    }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("logo_url, business_type, name").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);

  const company = clientRes.data as { logo_url?: string | null; business_type?: string | null; name?: string | null } | null;
  let calendarData = data;
  if (!isRealEstate(company?.business_type)) {
    const operational = await listOperationalCalendar(clientId, `${queryRange.startKey}T00:00:00.000Z`, `${queryRange.endKey}T00:00:00.000Z`);
    const extra: CompanyCalendarEvent[] = [
      ...operational.visits.map((visit) => {
        const row = visit as {
          id: string;
          project_id: string;
          title: string;
          status: string;
          scheduled_start_at: string;
          scheduled_end_at: string | null;
          site_address: string | null;
          assigned_lead_id: string | null;
        };
        return {
          id: `work-visit-${row.id}`,
          sourceType: "work_visit" as const,
          sourceId: row.id,
          kind: "field_visit" as const,
          title: row.title,
          startAt: row.scheduled_start_at,
          endAt: row.scheduled_end_at,
          allDay: false,
          status: row.status === "COMPLETED" ? "completed" as const : "scheduled" as const,
          sourceStatus: row.status,
          ownerId: row.assigned_lead_id,
          ownerName: null,
          ownerAvatarUrl: null,
          ownerRoleLabel: "Field visit",
          relationType: "customer" as const,
          relatedId: row.project_id,
          relatedLabel: row.title,
          relatedSecondary: row.site_address,
          relatedHref: `/client/projects/${row.project_id}/visits/${row.id}`,
          leadId: null,
          dealId: null,
          customerId: null,
          phone: null,
          location: row.site_address,
          description: "Field visit",
          attentionReason: null,
          canEdit: false,
          canComplete: false,
        };
      }),
      ...operational.projectStarts.map((project) => {
        const row = project as { id: string; title: string; project_number: string; scheduled_start_at: string; site_address: string | null; project_owner_id: string | null };
        return {
          id: `work-project-${row.id}`,
          sourceType: "work_project" as const,
          sourceId: row.id,
          kind: "project_start" as const,
          title: `Project start — ${row.title}`,
          startAt: row.scheduled_start_at,
          endAt: null,
          allDay: false,
          status: "scheduled" as const,
          sourceStatus: null,
          ownerId: row.project_owner_id,
          ownerName: null,
          ownerAvatarUrl: null,
          ownerRoleLabel: "Project",
          relationType: "customer" as const,
          relatedId: row.id,
          relatedLabel: row.project_number,
          relatedSecondary: row.site_address,
          relatedHref: `/client/projects/${row.id}`,
          leadId: null,
          dealId: null,
          customerId: null,
          phone: null,
          location: row.site_address,
          description: "Project",
          attentionReason: null,
          canEdit: false,
          canComplete: false,
        };
      }),
    ];
    calendarData = { ...data, events: [...data.events, ...extra] };
  }

  return (
    <ClientManagerLayout
      breadcrumbPage="CALENDAR"
      pageTitle="Calendar"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyCalendarPage
        data={calendarData}
        initialDateKey={anchorKey}
        initialView={searchParams.view}
        initialEventId={searchParams.event ?? null}
        initialOwnerId={searchParams.owner ?? "all"}
        canCreateActivities
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        companyLogoUrl={company?.logo_url ?? null}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
