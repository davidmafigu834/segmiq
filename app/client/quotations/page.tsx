import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyQuotationsPageData } from "@/lib/sales/get-company-quotations-page-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyQuotationsPage } from "@/components/dashboard/company/quotations/CompanyQuotationsPage";
import type { CompanyQuotationsPageData } from "@/components/dashboard/company/quotations/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientQuotationsPage({
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
  const [dataResult, unreadRes, userRes, clientRes, navBadges] = await Promise.all([
    getCompanyQuotationsPageData({
      clientId,
      actor: {
        userId: session.userId,
        role: session.role,
        clientId: session.clientId,
      },
    })
      .then((data) => ({ ok: true as const, data }))
      .catch((error: unknown) => {
        console.error("[company quotations] load failed:", error);
        return { ok: false as const };
      }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("logo_url, name").eq("id", clientId).maybeSingle(),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  const clientName =
    (clientRes.data as { name?: string | null } | null)?.name?.trim() || "Company";
  const data: CompanyQuotationsPageData = dataResult.ok
    ? dataResult.data
    : {
        clientId,
        clientName,
        currency: "USD",
        viewedTrackingEnabled: true,
        rows: [],
        counts: { all: 0, draft: 0, sent: 0, viewed: 0, accepted: 0, declined: 0 },
        totalValue: 0,
        owners: [],
        customers: [],
        deals: [],
        hasTemplates: false,
        createCandidates: [],
      };

  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);

  return (
    <ClientManagerLayout
      breadcrumbPage="QUOTATIONS"
      pageTitle="Quotations"
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyQuotationsPage
        data={data}
        loadError={dataResult.ok ? null : "We couldn't load quotations."}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
        companyLogoUrl={(clientRes.data as { logo_url?: string | null } | null)?.logo_url ?? null}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
