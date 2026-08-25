import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CommandCenterPage } from "@/components/dashboard/company/command/CommandCenterPage";

export const dynamic = "force-dynamic";

export default async function ClientCommandPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const previewClientId = searchParams.clientId;
  if (session.role === "SUPER_ADMIN") {
    if (!previewClientId && !session.clientId) redirect("/dashboard");
  } else if (session.role === "CLIENT_MANAGER") {
    if (!session.clientId) redirect("/login");
  } else {
    redirect("/sales/dashboard");
  }

  const clientId =
    session.role === "SUPER_ADMIN" ? previewClientId || session.clientId! : session.clientId!;
  const supabase = createAdminClient();
  const [unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("name, logo_url").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);
  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="COMMAND"
      pageTitle="Command Center"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CommandCenterPage
        clientId={clientId}
        companyName={(clientRes.data as { name?: string } | null)?.name ?? "Company"}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
