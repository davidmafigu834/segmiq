import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AgencyClientTeamTable } from "@/components/agency/AgencyClientTeamTable";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientHeroContext } from "@/lib/client-hero";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import type { UserRole } from "@/types";

export default async function ClientTeamPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client, hero } = ctx;
  const { data: users } = await supabase
    .from("users")
    .select("id, name, role, email")
    .eq("client_id", params.clientId)
    .eq("is_active", true)
    .in("role", ["CLIENT_MANAGER", "SALESPERSON"])
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  const members = (users ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    role: u.role as UserRole,
    email: u.email as string,
  }));

  return (
    <AgencyLayout breadcrumb="AGENCY / TEAM" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <p className="mb-4 font-mono text-[11px] text-ink-secondary">
          Impersonate a team member to see their CRM portal exactly as they do.
        </p>
        <AgencyClientTeamTable members={members} />
      </ClientDetailView>
    </AgencyLayout>
  );
}
