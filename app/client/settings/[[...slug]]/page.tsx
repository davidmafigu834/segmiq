import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanySettingsPage } from "@/components/dashboard/company/settings/CompanySettingsPage";
import { getCompanySettingsPageData } from "@/lib/settings/company-settings-data";
import { parseSettingsSlug, settingsPath } from "@/lib/settings/company-settings-config";
import { resolveSettingsAccess } from "@/lib/settings/company-settings-access";
import { getManagerPrefs } from "@/lib/notification-prefs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientSettingsPage({
  params,
  searchParams,
}: {
  params: { slug?: string[] };
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (session.role === "SALESPERSON") {
    redirect(session.clientMode === "solo" ? "/solo/dashboard" : "/sales/profile");
  }

  const previewClientId = searchParams.clientId;
  const clientId =
    session.role === "SUPER_ADMIN" ? previewClientId || session.clientId : session.clientId;
  if (!clientId) redirect(session.role === "SUPER_ADMIN" ? "/dashboard" : "/login");

  if (resolveSettingsAccess({ userId: session.userId, role: session.role, clientId }) !== "allow") {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase
      .from("users")
      .select("id, name, email, phone, avatar_url, notification_prefs, role")
      .eq("id", session.userId)
      .maybeSingle(),
    supabase.from("clients").select("business_type").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  const realEstate = (clientRes.data as { business_type?: string } | null)?.business_type === "real_estate";
  const parsed = parseSettingsSlug(params.slug, { realEstate });
  const canonical = settingsPath(parsed.category, parsed.section, previewClientId);
  const incomingPath = `/client/settings${params.slug?.length ? `/${params.slug.join("/")}` : ""}`;
  const canonicalPath = settingsPath(parsed.category, parsed.section);
  if (incomingPath !== canonicalPath && incomingPath !== `/client/settings/${parsed.category}`) {
    redirect(canonical);
  }

  const userRow = userRes.data as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    notification_prefs: unknown;
    role: string;
  } | null;

  const data = await getCompanySettingsPageData(clientId, {
    id: userRow?.id ?? session.userId,
    name: userRow?.name ?? session.user?.name ?? "User",
    email: userRow?.email ?? "",
    phone: userRow?.phone ?? null,
    avatarUrl: userRow?.avatar_url ?? null,
    role: userRow?.role ?? session.role ?? "CLIENT_MANAGER",
    notificationPrefs: getManagerPrefs(userRow?.notification_prefs),
  });

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="SETTINGS"
      pageTitle="Settings"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanySettingsPage
        data={data}
        category={parsed.category}
        section={parsed.section}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
        previewClientId={session.role === "SUPER_ADMIN" ? previewClientId ?? null : null}
      />
    </ClientManagerLayout>
  );
}
