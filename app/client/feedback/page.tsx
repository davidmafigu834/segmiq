import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyFeedbackPage } from "@/components/real-estate/feedback/CompanyFeedbackPage";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { viewingsFetchPlan } from "@/lib/real-estate/viewings";
import { loadCompanyPageChrome } from "@/lib/real-estate/company-page-chrome";

export const dynamic = "force-dynamic";

export default async function ClientFeedbackPage() {
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

  let viewings: Array<{
    id: string;
    scheduled_at: string;
    feedback_text: string | null;
    feedback_sentiment: string | null;
    contact_name: string | null;
    agent_name: string | null;
    listing_address: string | null;
    listing_suburb: string | null;
  }> = [];

  if (listingScope.kind === "scoped") {
    const { data: viewingRows } = await supabase
      .from("viewings")
      .select("id, contact_id, listing_id, agent_id, scheduled_at, feedback_text, feedback_sentiment")
      .in("listing_id", listingScope.listingIds)
      .not("feedback_text", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(200);

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
        feedback_text: (v.feedback_text as string | null) ?? null,
        feedback_sentiment: (v.feedback_sentiment as string | null) ?? null,
        contact_name: contactById.get(v.contact_id as string) ?? null,
        agent_name: v.agent_id ? agentById.get(v.agent_id as string) ?? null : null,
        listing_address: listing?.address ?? null,
        listing_suburb: listing?.suburb ?? null,
      };
    });
  }

  const chrome = await loadCompanyPageChrome({
    userId: session.userId,
    clientId: session.clientId,
    userName: session.user?.name ?? "User",
    role: session.role,
  });

  return (
    <ClientManagerLayout breadcrumbPage="FEEDBACK" pageTitle="Feedback" hideShellHeader hideShellSidebar>
      <CompanyFeedbackPage chrome={chrome} clientId={session.clientId} viewings={viewings} />
    </ClientManagerLayout>
  );
}
