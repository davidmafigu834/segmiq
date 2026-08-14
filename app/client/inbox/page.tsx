import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyWhatsAppHub } from "@/components/inbox/CompanyWhatsAppHub";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";

export const dynamic = "force-dynamic";

export default async function ClientInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER") redirect("/login");
  if (!session.clientId) redirect("/login");

  const supabase = createAdminClient();
  const [{ data: salespeople }, { data: client }, unreadResult, userResult, navBadges] = await Promise.all([
    supabase
      .from("users")
      .select("id, name")
      .eq("client_id", session.clientId)
      .eq("role", "SALESPERSON")
      .eq("is_active", true),
    supabase.from("clients").select("name, logo_url").eq("id", session.clientId).maybeSingle(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    fetchSalesNavBadges(session.userId, session.clientId),
  ]);

  const clientName = (client?.name as string) ?? "Your company";
  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout breadcrumbPage="INBOX" pageTitle="WhatsApp Sales Hub" hideShellHeader hideShellSidebar>
      <CompanyWhatsAppHub
        userName={session.user?.name ?? "Manager"}
        userId={session.userId}
        clientId={session.clientId}
        alsoSells={Boolean(session.alsoSells)}
        companyName={clientName}
        companyLogoUrl={(client?.logo_url as string | null) ?? null}
        avatarUrl={(userResult.data?.avatar_url as string | null) ?? null}
        unreadNotifications={unreadResult.count ?? 0}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
        salespeople={(salespeople ?? []) as { id: string; name: string }[]}
      />
    </ClientManagerLayout>
  );
}
