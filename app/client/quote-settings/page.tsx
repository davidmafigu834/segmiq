import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyQuoteSettingsPage } from "@/components/dashboard/company/quotations/CompanyQuoteSettingsPage";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientQuoteSettingsPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  if (session.role === "SALESPERSON") redirect("/sales/quotes");
  if (!(["CLIENT_MANAGER", "SUPER_ADMIN"] as string[]).includes(session.role)) {
    redirect("/login");
  }

  const previewClientId = searchParams.clientId;
  const clientId =
    session.role === "SUPER_ADMIN"
      ? previewClientId || session.clientId
      : session.clientId;
  if (!clientId) redirect(session.role === "SUPER_ADMIN" ? "/dashboard" : "/login");

  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("logo_url, name").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  if (!clientRes.data) redirect("/login");

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="QUOTATIONS"
      pageTitle="Quotation settings"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyQuoteSettingsPage
        clientId={clientId}
        companyName={(clientRes.data as { name?: string | null }).name?.trim() || "Company"}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null }).logo_url ?? null}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
