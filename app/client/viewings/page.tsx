import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalesNavBadges } from "@/lib/sales/nav-badges";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyViewingsPage } from "@/components/real-estate/viewings/CompanyViewingsPage";
import { CompanyViewingsPageSkeleton } from "@/components/real-estate/viewings/CompanyViewingsPageSkeleton";
import type { ViewingWorkspaceRow } from "@/components/real-estate/viewings/types";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import {
  viewingCompanyKpis,
  viewingCompanyTabCounts,
  viewingsFetchPlan,
} from "@/lib/real-estate/viewings";

export const dynamic = "force-dynamic";

export default async function ClientViewingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type, logo_url")
    .eq("id", session.clientId)
    .maybeSingle();

  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const { data: listings } = await supabase
    .from("listings")
    .select("id, address, suburb")
    .eq("client_id", session.clientId);
  const listingRows = listings ?? [];
  const listingById = new Map(
    listingRows.map((l) => [
      l.id as string,
      { address: (l.address as string | null) ?? null, suburb: (l.suburb as string | null) ?? null },
    ])
  );
  const listingScope = viewingsFetchPlan(listingRows.map((l) => l.id as string));
  const listingIds = listingScope.listingIds;

  let viewings: ViewingWorkspaceRow[] = [];
  if (listingScope.kind === "scoped") {
    const { data: viewingRows } = await supabase
      .from("viewings")
      .select(
        "id, contact_id, listing_id, agent_id, scheduled_at, status, feedback_text, feedback_sentiment"
      )
      .in("listing_id", listingIds)
      .order("scheduled_at", { ascending: true });

    const contactIds = [...new Set((viewingRows ?? []).map((v) => v.contact_id as string))];
    const agentIds = [
      ...new Set((viewingRows ?? []).map((v) => v.agent_id as string | null).filter(Boolean)),
    ] as string[];

    const [{ data: contacts }, { data: agents }] = await Promise.all([
      contactIds.length
        ? supabase.from("contacts").select("id, name, phone, email").eq("client_id", session.clientId).in("id", contactIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; phone: string | null; email: string | null }[] }),
      agentIds.length
        ? supabase.from("users").select("id, name").eq("client_id", session.clientId).in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    ]);

    const contactById = new Map(
      (contacts ?? []).map((c) => [
        c.id as string,
        {
          name: (c.name as string | null) ?? null,
          phone: (c.phone as string | null) ?? null,
          email: (c.email as string | null) ?? null,
        },
      ])
    );
    const agentById = new Map((agents ?? []).map((a) => [a.id as string, (a.name as string | null) ?? null]));

    viewings = (viewingRows ?? []).map((v) => {
      const listing = listingById.get(v.listing_id as string);
      const contact = contactById.get(v.contact_id as string);
      return {
        id: v.id as string,
        scheduled_at: v.scheduled_at as string,
        status: (v.status as string) ?? "scheduled",
        feedback_text: (v.feedback_text as string | null) ?? null,
        feedback_sentiment: (v.feedback_sentiment as string | null) ?? null,
        agent_id: (v.agent_id as string | null) ?? null,
        agent_name: v.agent_id ? agentById.get(v.agent_id as string) ?? null : null,
        contact_id: v.contact_id as string,
        contact_name: contact?.name ?? null,
        contact_phone: contact?.phone ?? null,
        contact_email: contact?.email ?? null,
        listing_id: v.listing_id as string,
        listing_address: listing?.address ?? null,
        listing_suburb: listing?.suburb ?? null,
      };
    });
  }

  const { data: teamUsers } = await supabase
    .from("users")
    .select("id, name")
    .eq("client_id", session.clientId)
    .order("name", { ascending: true });

  const [unreadRes, userRes, navBadges] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .eq("read", false),
    supabase.from("users").select("avatar_url").eq("id", session.userId).maybeSingle(),
    fetchSalesNavBadges(session.userId, session.clientId),
  ]);

  const whatsappBadge =
    (navBadges.hotLeads || 0) + (navBadges.needsReply || 0) + (navBadges.followUpDue || 0);

  const agents = (teamUsers ?? [])
    .map((user) => ({
      id: user.id as string,
      name: ((user.name as string | null) ?? "").trim() || "Agent",
    }))
    .filter((user) => user.id);

  return (
    <ClientManagerLayout
      breadcrumbPage="VIEWINGS"
      pageTitle="Viewings"
      hideShellHeader
      hideShellSidebar
    >
      <Suspense fallback={<CompanyViewingsPageSkeleton />}>
        <CompanyViewingsPage
          data={{
            clientId: session.clientId,
            clientName: (client.name as string) ?? "Company",
            rows: viewings,
            kpis: viewingCompanyKpis(viewings),
            tabCounts: viewingCompanyTabCounts(viewings),
            agents,
            listings: listingRows.map((listing) => ({
              id: listing.id as string,
              address: (listing.address as string | null) ?? null,
              suburb: (listing.suburb as string | null) ?? null,
            })),
          }}
          unreadNotifications={unreadRes.count ?? 0}
          notificationRole={session.role}
          userName={session.user?.name ?? "User"}
          avatarUrl={(userRes.data as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          companyLogoUrl={(client.logo_url as string | null) ?? null}
          whatsappBadge={whatsappBadge}
        />
      </Suspense>
    </ClientManagerLayout>
  );
}
