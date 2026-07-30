import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencySettings } from "@/lib/agency-settings";
import { buildClientDetailHero } from "@/lib/client-hero";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { ClientSettingsClient } from "@/components/client-settings/ClientSettingsClient";
import { fetchRoundRobinEligibleUsers } from "@/lib/auth/sales-capabilities";

export const dynamic = "force-dynamic";

export default async function ClientSettingsPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { tab?: string };
}) {
  const supabase = createAdminClient();
  const agency = await getAgencySettings();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle();
  if (!client) notFound();

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select("is_published, slug")
    .eq("client_id", params.clientId)
    .maybeSingle();

  const { data: salespeople } = await fetchRoundRobinEligibleUsers(supabase, params.clientId, {
    activeOnly: false,
  });

  const { data: managers } = await supabase
    .from("users")
    .select("id, name, email, phone, is_active, also_sells")
    .eq("client_id", params.clientId)
    .eq("role", "CLIENT_MANAGER")
    .order("created_at", { ascending: true });

  const { data: instantForms } = await supabase
    .from("instant_forms")
    .select("id, name, status")
    .eq("client_id", params.clientId)
    .order("updated_at", { ascending: false });

  const profileSlug = (clientProfile as { slug?: string } | null)?.slug ?? null;
  const profilePublished = Boolean((clientProfile as { is_published?: boolean } | null)?.is_published);
  const publicProfileUrl = profileSlug ? getPublicLandingPageUrl(profileSlug) : null;
  const hero = buildClientDetailHero(
    {
      fb_form_id: client.fb_form_id as string | null,
      fb_page_id: client.fb_page_id as string | null,
      fb_page_name: client.fb_page_name as string | null,
      fb_token_expired_at: client.fb_token_expired_at as string | null,
      twilio_whatsapp_override: client.twilio_whatsapp_override as string | null,
    },
    profilePublished,
    profileSlug
  );
  const initialTab = typeof searchParams.tab === "string" ? searchParams.tab : undefined;

  return (
    <AgencyLayout
      hideShellHeader
      breadcrumb={`PLATFORM / ${(client.name as string).toUpperCase()} / SETTINGS`}
      pageTitle={client.name as string}
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <ClientSettingsClient
          clientId={params.clientId}
          initialClient={client as Record<string, unknown>}
          initialSalespeople={(salespeople ?? []) as never}
          initialManagers={(managers ?? []) as never}
          initialInstantForms={(instantForms ?? []) as { id: string; name: string; status: string }[]}
          agencyDefaultHours={agency.default_response_time_limit_hours}
          initialTab={initialTab}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}
