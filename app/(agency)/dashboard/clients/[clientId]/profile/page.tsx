import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "../ClientDetailView";
import { buildClientDetailHero } from "@/lib/client-hero";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { ProfileSettings } from "./ProfileSettings";

export default async function ProfilePage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const [{ data: client }, { data: clientProfile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase.from("client_profiles").select("*").eq("client_id", params.clientId).maybeSingle(),
  ]);
  if (!client) notFound();

  const profileSlug = (clientProfile as { slug?: string } | null)?.slug ?? (client.slug as string);
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

  return (
    <AgencyLayout
      breadcrumb={`PLATFORM / CLIENTS / ${(client.name as string).toUpperCase()} / PROFILE PAGE`}
      pageTitle="Profile Page"
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <ProfileSettings
          clientId={params.clientId}
          clientName={client.name as string}
          clientSlug={client.slug as string}
          accentColor={(client.primary_color as string | null) ?? "#D4FF4F"}
          initialProfile={(clientProfile as unknown as ProfileRow | null)}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}

type ProfileRow = {
  id: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  form_title: string | null;
  is_published: boolean;
};
