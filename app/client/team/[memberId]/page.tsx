import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyTeamMemberOverview } from "@/lib/sales/get-company-team-member-overview";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import { Avatar, Badge, Button, Card } from "@/components/sales/ui";

export default async function CompanyTeamMemberProfilePage({
  params,
}: {
  params: { memberId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  if (!["CLIENT_MANAGER", "SUPER_ADMIN"].includes(session.role)) redirect("/login");

  const clientId = session.clientId;
  const supabase = createAdminClient();

  const [overview, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyTeamMemberOverview({
      clientId,
      memberId: params.memberId,
      alsoSells: Boolean(session.alsoSells),
    }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("name, logo_url").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  if (!overview) notFound();

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="TEAM"
      pageTitle={overview.name}
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyWorkspaceShell
        companyName={(clientRes.data as { name?: string } | null)?.name}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        whatsappBadge={whatsappBadge}
      >
        <CompanyDashboardHeader
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
          userName={session.user?.name ?? "User"}
          avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          canAddLead
          breadcrumb="Company / Team"
          title={overview.name}
          description={overview.titleLabel}
        />

        <Card className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar name={overview.name} src={overview.avatarUrl} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-semibold text-sales-text-primary">{overview.name}</h2>
                <Badge tone={overview.isActive ? "success" : "neutral"}>
                  {overview.accountStatusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-[13px] text-sales-text-secondary">{overview.roleColumn}</p>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] text-sales-text-muted">Email</dt>
                  <dd className="text-[13px] text-sales-text-primary">{overview.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-sales-text-muted">Phone</dt>
                  <dd className="text-[13px] text-sales-text-primary">{overview.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-sales-text-muted">Active Deals</dt>
                  <dd className="text-[13px] font-semibold tabular-nums">{overview.activeDeals}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-sales-text-muted">Pipeline Value</dt>
                  <dd className="text-[13px] font-semibold tabular-nums">
                    {overview.pipelineValueLabel}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/client/team?member=${overview.id}`}>
              <Button variant="secondary" size="sm">
                Back to Team
              </Button>
            </Link>
            <Link href="/client/leads/pipeline">
              <Button variant="primary" size="sm">
                View pipeline
              </Button>
            </Link>
          </div>
        </Card>
      </CompanyWorkspaceShell>
    </ClientManagerLayout>
  );
}
