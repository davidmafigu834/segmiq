import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyCustomerProfilePage } from "@/components/dashboard/company/customers/CompanyCustomerProfilePage";
import { getCompanyCustomerProfileData } from "@/lib/sales/get-company-customers-page-data";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import type { CompanyCustomersOwnerOption } from "@/components/dashboard/company/customers/types";

export const dynamic = "force-dynamic";

type TeamMember = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  also_sells: boolean | null;
  is_active: boolean | null;
};

export default async function CompanyCustomerProfileRoute({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { clientId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN") {
    redirect("/sales/customers");
  }

  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, client_id, lifecycle")
    .eq("id", params.id)
    .maybeSingle();

  if (!contact || contact.lifecycle !== "customer") notFound();
  if (session.role === "CLIENT_MANAGER" && contact.client_id !== session.clientId) notFound();
  if (
    session.role === "SUPER_ADMIN" &&
    searchParams?.clientId &&
    contact.client_id !== searchParams.clientId
  ) {
    notFound();
  }

  const clientId = contact.client_id as string;
  const [data, unreadRes, userRes, clientRes, teamRes, navBadges] = await Promise.all([
    getCompanyCustomerProfileData({ clientId, customerId: params.id }),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    supabase.from("clients").select("name, logo_url").eq("id", clientId).maybeSingle(),
    supabase
      .from("users")
      .select("id, name, avatar_url, role, also_sells, is_active")
      .eq("client_id", clientId)
      .in("role", ["SALESPERSON", "CLIENT_MANAGER"])
      .order("name", { ascending: true }),
    fetchSalesNavBadges(session.userId, clientId),
  ]);

  if (!data) notFound();

  const owners: CompanyCustomersOwnerOption[] = ((teamRes.data ?? []) as TeamMember[])
    .filter((member) => member.is_active !== false)
    .filter((member) => member.role === "SALESPERSON" || Boolean(member.also_sells))
    .map((member) => ({
      id: member.id,
      name: member.name?.trim() || "Team member",
      avatarUrl: member.avatar_url,
    }));
  const whatsappBadge =
    (navBadges.hotLeads || 0) +
    (navBadges.needsReply || 0) +
    (navBadges.followUpDue || 0);
  const client = clientRes.data as {
    name?: string | null;
    logo_url?: string | null;
  } | null;

  return (
    <ClientManagerLayout
      breadcrumbPage="CUSTOMER"
      pageTitle={data.customer.name}
      hideShellHeader
      hideShellSidebar
      navClientId={clientId}
    >
      <CompanyCustomerProfilePage
        data={data}
        owners={owners}
        clientId={clientId}
        clientName={client?.name?.trim() || "Company"}
        unreadNotifications={unreadRes.count ?? 0}
        notificationRole={session.role}
        userName={session.user?.name ?? "User"}
        avatarUrl={
          (userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null
        }
        companyLogoUrl={client?.logo_url ?? null}
        whatsappBadge={whatsappBadge}
      />
    </ClientManagerLayout>
  );
}
