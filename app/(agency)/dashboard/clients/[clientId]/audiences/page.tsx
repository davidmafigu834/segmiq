import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "../ClientDetailView";
import { buildClientDetailHero } from "@/lib/client-hero";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { AudienceSegmentsMain } from "./AudienceSegmentsMain";

export const dynamic = "force-dynamic";

export default async function AudiencesPage({
  params,
}: {
  params: { clientId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.role === "SALESPERSON") {
    redirect("/dashboard");
  }

  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle();

  if (!client) notFound();

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select("is_published, slug")
    .eq("client_id", params.clientId)
    .maybeSingle();

  const profileSlug = (clientProfile as { slug?: string } | null)?.slug ?? null;
  const profilePublished = Boolean(
    (clientProfile as { is_published?: boolean } | null)?.is_published
  );
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

  const isAgencyAdmin = session.role === "AGENCY_ADMIN";

  return (
    <AgencyLayout
      hideShellHeader
      breadcrumb={`AGENCY / ${(client.name as string).toUpperCase()} / AUDIENCES`}
      pageTitle={client.name as string}
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <AudienceSegmentsMain
          clientId={params.clientId}
          isAgencyAdmin={isAgencyAdmin}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}
