import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { SocialInboxCompanyHost } from "@/components/social-inbox/SocialInboxWorkspace";

export const dynamic = "force-dynamic";

export default async function CompanySocialInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER") redirect("/login");
  if (!session.clientId) redirect("/login");

  const supabase = createAdminClient();
  const [{ data: client }, unreadResult, userResult, navBadges] = await Promise.all([
    supabase.from("clients").select("name, logo_url").eq("id", session.clientId).maybeSingle(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    fetchSalesNavBadges(session.userId, session.clientId),
  ]);

  const whatsappBadge = (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-sales-text-muted">Loading Social Inbox…</div>}>
    <SocialInboxCompanyHost
      userName={session.user?.name ?? "Manager"}
      companyName={(client?.name as string) ?? "Your company"}
      companyLogoUrl={(client?.logo_url as string | null) ?? null}
      avatarUrl={(userResult.data?.avatar_url as string | null) ?? null}
      unreadNotifications={unreadResult.count ?? 0}
      notificationRole={session.role}
      whatsappBadge={whatsappBadge}
      quotesBase="/client/quotations?lead="
      leadsBase="/client/leads?lead="
      dealsBase="/client/deals/"
      channelsHref="/client/settings/integrations/channels"
      viewerId={session.userId}
      clientId={session.clientId!}
    />
    </Suspense>
  );
}
