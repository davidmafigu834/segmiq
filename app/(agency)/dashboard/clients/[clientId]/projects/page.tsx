import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientDetailView } from "../ClientDetailView";
import { buildClientDetailHero } from "@/lib/client-hero";
import { getPublicLandingPageUrl } from "@/lib/public-url";
import { ProjectsManager } from "./ProjectsManager";

export default async function ProjectsPage({ params }: { params: { clientId: string } }) {
  const supabase = createAdminClient();
  const [{ data: client }, { data: clientProfile }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.clientId).maybeSingle(),
    supabase.from("client_profiles").select("is_published, slug").eq("client_id", params.clientId).maybeSingle(),
  ]);
  if (!client) notFound();

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

  const { data: projects } = await supabase
    .from("projects")
    .select("*, project_media(id, public_url, display_order)")
    .eq("client_id", params.clientId)
    .order("display_order", { ascending: true });

  return (
    <AgencyLayout
      breadcrumb={`PLATFORM / CLIENTS / ${(client.name as string).toUpperCase()} / PROJECTS`}
      pageTitle="Projects"
    >
      <ClientDetailView
        clientId={params.clientId}
        name={client.name as string}
        industry={client.industry as string}
        agencyManaged={Boolean((client as { agency_managed?: boolean | null }).agency_managed ?? true)}
        publicProfileUrl={publicProfileUrl}
        hero={hero}
      >
        <ProjectsManager
          clientId={params.clientId}
          clientName={client.name as string}
          initialProjects={(projects ?? []) as unknown as ProjectRow[]}
        />
      </ClientDetailView>
    </AgencyLayout>
  );
}

type ProjectRow = {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  completion_date: string | null;
  is_featured: boolean;
  is_public: boolean;
  slug: string;
  display_order: number;
  project_media: { id: string; public_url: string; display_order: number }[];
};
