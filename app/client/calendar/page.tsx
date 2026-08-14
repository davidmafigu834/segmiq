import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canActAsSalesperson } from "@/lib/auth/sales-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSalesTimezone, planDateInTimezone } from "@/lib/sales/intelligence/timezone";
import { companyCalendarQueryRange } from "@/lib/sales/company-calendar/format";
import { getCompanyCalendarData } from "@/lib/sales/get-company-calendar-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyCalendarPage } from "@/components/dashboard/company/calendar/CompanyCalendarPage";

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
    supabase.from("clients").select("logo_url").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="CALENDAR"
      pageTitle="Calendar"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyCalendarPage
        data={data}
        initialDateKey={anchorKey}
        initialView={searchParams.view}
        initialEventId={searchParams.event ?? null}
        initialOwnerId={searchParams.owner ?? "all"}
        canCreateActivities
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        companyLogoUrl={
          (clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null
        }
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
