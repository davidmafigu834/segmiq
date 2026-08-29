import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { ViewingsWorkspace, type ViewingWorkspaceRow } from "@/components/real-estate/ViewingsWorkspace";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { viewingsFetchPlan } from "@/lib/real-estate/viewings";

export const dynamic = "force-dynamic";

export default async function ClientViewingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
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
        ? supabase.from("contacts").select("id, name").eq("client_id", session.clientId).in("id", contactIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
      agentIds.length
        ? supabase.from("users").select("id, name").eq("client_id", session.clientId).in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    ]);

    const contactById = new Map((contacts ?? []).map((c) => [c.id as string, (c.name as string | null) ?? null]));
    const agentById = new Map((agents ?? []).map((a) => [a.id as string, (a.name as string | null) ?? null]));

    viewings = (viewingRows ?? []).map((v) => {
      const listing = listingById.get(v.listing_id as string);
      return {
        id: v.id as string,
        scheduled_at: v.scheduled_at as string,
        status: (v.status as string) ?? "scheduled",
        feedback_text: (v.feedback_text as string | null) ?? null,
        feedback_sentiment: (v.feedback_sentiment as string | null) ?? null,
        agent_id: (v.agent_id as string | null) ?? null,
        agent_name: v.agent_id ? agentById.get(v.agent_id as string) ?? null : null,
        contact_id: v.contact_id as string,
        contact_name: contactById.get(v.contact_id as string) ?? null,
        listing_id: v.listing_id as string,
        listing_address: listing?.address ?? null,
        listing_suburb: listing?.suburb ?? null,
      };
    });
  }

  return (
    <ClientManagerLayout
      breadcrumbPage="VIEWINGS"
      pageTitle="Viewings"
      workspaceShell
      workspaceTitle="Viewings"
      workspaceDescription="Upcoming and completed property viewings."
    >
      <ViewingsWorkspace clientId={session.clientId} viewings={viewings} />
    </ClientManagerLayout>
  );
}
