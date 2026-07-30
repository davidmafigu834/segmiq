import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientHeroContext } from "@/lib/client-hero";
import { ClientDetailView } from "../ClientDetailView";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { FacebookConnectPanel } from "./FacebookConnectPanel";
import type { FacebookClientSnapshot } from "./FacebookConnectPanel";

export default async function FacebookPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const ctx = await loadClientHeroContext(params.clientId);
  if (!ctx) notFound();
  const { client: c, hero } = ctx;
  const client = c;

  const { data: lastFbLead } = await supabase
    .from("leads")
    .select("created_at")
    .eq("client_id", params.clientId)
    .eq("source", "FACEBOOK")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const initial: FacebookClientSnapshot = {
    fb_access_token: (client.fb_access_token as string | null) ?? null,
    fb_access_token_expires_at: (client.fb_access_token_expires_at as string | null) ?? null,
    fb_ad_account_id: (client.fb_ad_account_id as string | null) ?? null,
    fb_page_id: (client.fb_page_id as string | null) ?? null,
    fb_page_name: (client.fb_page_name as string | null) ?? null,
    fb_form_id: (client.fb_form_id as string | null) ?? null,
    fb_form_name: (client.fb_form_name as string | null) ?? null,
    fb_webhook_verified: (client.fb_webhook_verified as boolean | null) ?? null,
    fb_token_expired_at: (client.fb_token_expired_at as string | null) ?? null,
    last_lead_received_at: (client.last_lead_received_at as string | null) ?? null,
  };

  return (
    <AgencyLayout breadcrumb="PLATFORM / FACEBOOK" pageTitle={client.name as string}>
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={hero.profileSlug ? getPublicLandingPageUrl(hero.profileSlug) : null}
        hero={hero}
      >
        <Suspense fallback={<p className="text-sm text-ink-secondary">Loading…</p>}>
          <FacebookConnectPanel
            clientId={params.clientId}
            initial={initial}
            lastFacebookLeadAt={(lastFbLead?.created_at as string | undefined) ?? null}
          />
        </Suspense>
      </ClientDetailView>
    </AgencyLayout>
  );
}
